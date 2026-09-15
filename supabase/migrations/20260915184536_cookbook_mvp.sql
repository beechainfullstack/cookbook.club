create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public, anon, authenticated;
create type public.flavor as enum ('art', 'sports', 'style', 'music', 'ideas', 'kindness');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  location text not null,
  active boolean not null default true
);
create table private.school_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools,
  code_hash text not null unique,
  expires_at timestamptz not null,
  uses_remaining integer not null check (uses_remaining >= 0)
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  school_id uuid not null references public.schools,
  display_name text not null check (length(trim(display_name)) between 2 and 40),
  created_at timestamptz not null default now()
);
create index profiles_school on public.profiles (school_id);
create table private.memberships (
  user_id uuid primary key references public.profiles on delete cascade,
  birth_date date not null,
  verified_at timestamptz not null default now()
);
create table private.contacts (
  owner_id uuid not null references public.profiles on delete cascade,
  contact_id uuid not null references public.profiles on delete cascade,
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
create table public.book_entries (
  id uuid primary key,
  school_id uuid not null references public.schools,
  tagged_user_id uuid not null references public.profiles,
  tagged_name text not null,
  flavor public.flavor not null,
  created_at timestamptz not null default clock_timestamp(),
  revealed boolean not null default false,
  tagger_names text[] not null default '{}',
  tagger_user_ids uuid[] not null default '{}',
  check (
    (not revealed and cardinality(tagger_names) = 0 and cardinality(tagger_user_ids) = 0)
    or (revealed and cardinality(tagger_names) = 3 and cardinality(tagger_user_ids) = 3)
  )
);
create index book_chronology on public.book_entries (school_id, created_at desc, id desc);
create index book_recipient on public.book_entries (tagged_user_id, created_at desc, id desc);
create table private.tags (
  entry_id uuid primary key references public.book_entries,
  tagger_id uuid not null references public.profiles,
  tagged_id uuid not null references public.profiles,
  created_at timestamptz not null default clock_timestamp()
);
create index tags_recipient on private.tags (tagged_id, tagger_id, created_at);
create index tags_sender on private.tags (tagger_id, created_at);
create table private.reveals (
  tagged_id uuid primary key references public.profiles,
  tagger_ids uuid[] not null check (cardinality(tagger_ids) = 3),
  tagger_names text[] not null check (cardinality(tagger_names) = 3),
  created_at timestamptz not null default now()
);
create table private.push_tokens (
  token text primary key check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user on private.push_tokens (user_id);
create table private.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references private.reveals (tagged_id),
  flavor public.flavor not null,
  created_at timestamptz not null default now()
);
create table private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references private.push_outbox,
  token text not null references private.push_tokens on delete cascade,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  sent_at timestamptz,
  ticket_id text,
  last_error text,
  unique (outbox_id, token)
);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.book_entries enable row level security;
create function public.my_school_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select school_id from public.profiles where id = auth.uid() $$;
create policy schools_authenticated on public.schools for select to authenticated using (active);
create policy profiles_school on public.profiles for select to authenticated
using (school_id = (select public.my_school_id()));
create policy book_school on public.book_entries for select to authenticated
using (school_id = (select public.my_school_id()));
revoke all on public.schools, public.profiles, public.book_entries from anon, authenticated;
grant select on public.schools, public.profiles, public.book_entries to authenticated;

create function public.enroll(p_birth_date date, p_display_name text, p_school_id uuid, p_school_code text)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user is null or not exists (
    select 1 from auth.users where id = v_user and phone_confirmed_at is not null and phone is not null
  ) then raise exception 'NOT_AUTHORIZED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_profile from public.profiles where id = v_user;
  if found then return v_profile; end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > current_date
    then raise exception 'INVALID_BIRTHDAY'; end if;
  if p_birth_date + interval '13 years' > current_date then raise exception 'AGE_BLOCKED'; end if;
  if p_display_name is null or length(trim(p_display_name)) not between 2 and 40
    or p_display_name ~ '[[:cntrl:]<>]' then raise exception 'INVALID_NAME'; end if;
  if not exists (select 1 from public.schools where id = p_school_id and active)
    then raise exception 'INVALID_SCHOOL_CODE'; end if;
  update private.school_codes set uses_remaining = uses_remaining - 1
  where school_id = p_school_id
    and code_hash = encode(extensions.digest(trim(p_school_code), 'sha256'), 'hex')
    and expires_at > now() and uses_remaining > 0;
  if not found then raise exception 'INVALID_SCHOOL_CODE'; end if;
  insert into public.profiles (id, school_id, display_name)
  values (v_user, p_school_id, trim(p_display_name)) returning * into v_profile;
  insert into private.memberships (user_id, birth_date) values (v_user, p_birth_date);
  return v_profile;
end $$;

create function public.sync_contacts(p_phones text[]) returns table (id uuid, display_name text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_school uuid := public.my_school_id();
begin
  if v_school is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_phones is null or cardinality(p_phones) > 5000 then raise exception 'TOO_MANY_CONTACTS'; end if;
  if exists (select 1 from unnest(p_phones) as number where number is null or number !~ '^\+[1-9][0-9]{7,14}$')
    then raise exception 'INVALID_PHONE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 1));
  delete from private.contacts where owner_id = v_user;
  insert into private.contacts (owner_id, contact_id)
  select distinct v_user, p.id from public.profiles p join auth.users u on u.id = p.id
  where p.school_id = v_school and p.id <> v_user and u.phone_confirmed_at is not null
    and ('+' || ltrim(u.phone, '+')) = any(p_phones);
  return query select p.id, p.display_name from public.profiles p join private.contacts c on c.contact_id = p.id
    where c.owner_id = v_user order by p.display_name;
end $$;

create function public.get_contacts() returns table (id uuid, display_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name from public.profiles p join private.contacts c on c.contact_id = p.id
  where c.owner_id = auth.uid() and p.school_id = public.my_school_id() order by p.display_name
$$;

create function private.reveal_after_tag() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[];
  v_names text[];
begin
  select tagger_ids, tagger_names into v_ids, v_names from private.reveals where tagged_id = new.tagged_id;
  if not found then
    select array_agg(t.tagger_id order by t.first_tag, t.tagger_id),
      array_agg(p.display_name order by t.first_tag, t.tagger_id) into v_ids, v_names
    from (
      select tagger_id, min(created_at) as first_tag from private.tags
      where tagged_id = new.tagged_id group by tagger_id order by first_tag, tagger_id limit 3
    ) t join public.profiles p on p.id = t.tagger_id;
    if cardinality(v_ids) = 3 then
      insert into private.reveals (tagged_id, tagger_ids, tagger_names) values (new.tagged_id, v_ids, v_names);
      insert into private.push_outbox (user_id, flavor)
      select new.tagged_id, flavor from public.book_entries where id = new.entry_id;
    end if;
  end if;
  if cardinality(v_ids) = 3 then
    update public.book_entries set revealed = true, tagger_names = v_names, tagger_user_ids = v_ids
    where tagged_user_id = new.tagged_id and not revealed;
  end if;
  return new;
end $$;
create trigger reveal_after_tag after insert on private.tags for each row execute function private.reveal_after_tag();

create function public.create_tag(p_tagged_id uuid, p_flavor public.flavor, p_request_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_school uuid := public.my_school_id();
  v_target public.profiles;
  v_existing private.tags;
begin
  if v_school is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_request_id is null or p_flavor is null then raise exception 'INVALID_TAG'; end if;
  select * into v_target from public.profiles where id = p_tagged_id for update;
  if not found or p_tagged_id = v_user or v_target.school_id <> v_school
    or not exists (select 1 from private.contacts where owner_id = v_user and contact_id = p_tagged_id)
    then raise exception 'CONTACT_REQUIRED'; end if;
  select * into v_existing from private.tags where entry_id = p_request_id;
  if found then
    if v_existing.tagger_id = v_user and v_existing.tagged_id = p_tagged_id
      and exists (select 1 from public.book_entries where id = p_request_id and flavor = p_flavor)
      then return p_request_id; end if;
    raise exception 'INVALID_TAG';
  end if;
  if exists (select 1 from private.tags where tagger_id = v_user and tagged_id = p_tagged_id
    and created_at > clock_timestamp() - interval '1 minute') then raise exception 'RATE_LIMITED'; end if;
  insert into public.book_entries (id, school_id, tagged_user_id, tagged_name, flavor)
    values (p_request_id, v_school, p_tagged_id, v_target.display_name, p_flavor);
  insert into private.tags (entry_id, tagger_id, tagged_id) values (p_request_id, v_user, p_tagged_id);
  return p_request_id;
end $$;

create function public.get_book(
  p_before_time timestamptz default null, p_before_id uuid default null,
  p_recipient uuid default null, p_flavor public.flavor default null
) returns setof public.book_entries
language sql stable security invoker set search_path = ''
as $$
  select * from public.book_entries
  where (p_before_time is null or (created_at, id) < (p_before_time, p_before_id))
    and (p_recipient is null or tagged_user_id = p_recipient)
    and (p_flavor is null or flavor = p_flavor)
  order by created_at desc, id desc limit 30
$$;

create function public.register_push_token(p_token text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_school_id() is null then raise exception 'NOT_AUTHORIZED'; end if;
  insert into private.push_tokens (token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end $$;
create function public.remove_push_token(p_token text) returns void
language sql security definer set search_path = ''
as $$ delete from private.push_tokens where token = p_token and user_id = auth.uid() $$;

create function public.claim_push_deliveries()
returns table (id uuid, token text, user_id uuid, lease_id uuid, flavor public.flavor)
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.push_deliveries (outbox_id, token)
  select o.id, t.token from private.push_outbox o join private.push_tokens t on t.user_id = o.user_id
  where o.created_at > now() - interval '7 days' on conflict do nothing;
  return query
  with ready as (
    select d.id from private.push_deliveries d
    join private.push_outbox o on o.id = d.outbox_id
    join private.push_tokens t on t.token = d.token and t.user_id = o.user_id
    where d.sent_at is null and d.attempts < 8 and d.available_at <= now()
    order by d.available_at for update of d skip locked limit 100
  ), claimed as (
    update private.push_deliveries d set attempts = attempts + 1,
      available_at = now() + interval '5 minutes', lease_id = gen_random_uuid()
    from ready r where d.id = r.id returning d.*
  )
  select c.id, c.token, o.user_id, c.lease_id, o.flavor from claimed c join private.push_outbox o on o.id = c.outbox_id;
end $$;

create function public.finish_push_delivery(
  p_id uuid, p_lease_id uuid, p_ticket_id text default null, p_error text default null,
  p_remove_token boolean default false
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_token text;
begin
  update private.push_deliveries set
    sent_at = case when p_ticket_id is not null then now() else null end,
    ticket_id = p_ticket_id, last_error = p_error,
    available_at = now() + make_interval(secs => least(3600, (power(2, attempts) * 30)::integer))
  where id = p_id and lease_id = p_lease_id returning token into v_token;
  if p_remove_token and v_token is not null then delete from private.push_tokens where token = v_token; end if;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_school_id() to authenticated;
grant execute on function public.enroll(date, text, uuid, text) to authenticated;
grant execute on function public.sync_contacts(text[]) to authenticated;
grant execute on function public.get_contacts() to authenticated;
grant execute on function public.create_tag(uuid, public.flavor, uuid) to authenticated;
grant execute on function public.get_book(timestamptz, uuid, uuid, public.flavor) to authenticated;
grant execute on function public.register_push_token(text) to authenticated;
grant execute on function public.remove_push_token(text) to authenticated;
grant execute on function public.claim_push_deliveries() to service_role;
grant execute on function public.finish_push_delivery(uuid, uuid, text, text, boolean) to service_role;
alter publication supabase_realtime add table public.book_entries;