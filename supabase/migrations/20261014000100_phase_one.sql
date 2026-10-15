create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  onboarding_completed_at timestamptz,
  messaging_hold boolean not null default false
);

create table public.survey_answers (
  user_id uuid primary key references public.users(id) on delete cascade,
  priorities text[] not null default '{}' check (priorities <@ array['hobbies', 'emotional support', 'inspiration', 'accountability', 'finance', 'universal understanding (astrological)', 'other']::text[]),
  priorities_other text not null default '' check (length(priorities_other) <= 1000),
  goals text[] not null default '{}' check (goals <@ array['social skills', 'finance', 'understanding', 'music', 'love life', 'diet', 'health', 'household chores/cleaning', 'other']::text[]),
  goals_other text not null default '' check (length(goals_other) <= 1000),
  putting_off text not null default '' check (length(putting_off) <= 4000),
  inspirations text not null default '' check (length(inspirations) <= 4000),
  saved_step smallint not null default 0 check (saved_step between 0 and 4),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null unique,
  season_tag text not null check (season_tag in ('spring', 'summer', 'autumn', 'winter')),
  uploaded_at timestamptz not null default now(),
  last_shown_at timestamptz,
  check (storage_path = user_id::text || '/' || id::text || '.jpg')
);
create index photos_user_id_idx on public.photos(user_id);

create function public.is_timezone(value text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = value);
$$;

create table public.notification_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  day smallint not null default 0 check (day between 0 and 6),
  time time not null default '09:00' check (time < '24:00'),
  timezone text not null default 'UTC' check (public.is_timezone(timezone)),
  channels text[] not null default array['email']::text[] check (channels <@ array['email', 'push']::text[] and cardinality(channels) <= 2),
  paused boolean not null default false,
  star_mode boolean not null default false,
  expo_push_token text,
  updated_at timestamptz not null default now()
);

create table public.sky_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('new_moon', 'full_moon', 'equinox', 'solstice', 'planetary')),
  occurs_at timestamptz not null,
  data jsonb not null default '{}'::jsonb,
  computation_source text not null,
  unique (type, occurs_at)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('weekly', 'seasonal', 'reminder', 'safety')),
  content text not null,
  channels text[] not null default '{}' check (channels <@ array['email', 'push']::text[]),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,8) not null default 0 check (cost_usd >= 0),
  unique (id, user_id)
);
create index messages_user_sent_idx on public.messages(user_id, sent_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message_id uuid not null,
  rating smallint not null check (rating in (-1, 1)),
  comment text check (length(comment) <= 280),
  created_at timestamptz not null default now(),
  unique (message_id, user_id),
  foreign key (message_id, user_id) references public.messages(id, user_id) on delete cascade
);
create index feedback_user_id_idx on public.feedback(user_id);

create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  cost_usd numeric(12,8) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index llm_usage_created_at_idx on public.llm_usage(created_at);

create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id) values (new.id);
  return new;
end;
$$;
create trigger auth_user_created after insert on auth.users
for each row execute function public.create_profile();

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger survey_updated before update on public.survey_answers
for each row execute function public.set_updated_at();
create trigger notification_settings_updated before update on public.notification_settings
for each row execute function public.set_updated_at();

create function public.complete_onboarding() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if not exists (
    select 1 from public.survey_answers
    where user_id = auth.uid() and saved_step = 4
      and cardinality(priorities) > 0 and cardinality(goals) > 0 and length(trim(inspirations)) > 0
      and (not ('other' = any(priorities)) or length(trim(priorities_other)) > 0)
      and (not ('other' = any(goals)) or length(trim(goals_other)) > 0)
  ) or not exists (
    select 1 from public.notification_settings where user_id = auth.uid()
  ) then
    raise exception 'Finish the survey and notification settings first';
  end if;
  update public.users set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = auth.uid();
end;
$$;

alter table public.users enable row level security;
alter table public.survey_answers enable row level security;
alter table public.photos enable row level security;
alter table public.notification_settings enable row level security;
alter table public.messages enable row level security;
alter table public.feedback enable row level security;
alter table public.sky_events enable row level security;
alter table public.llm_usage enable row level security;

create policy users_read_own on public.users for select to authenticated using ((select auth.uid()) = id);
create policy survey_read_own on public.survey_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy survey_insert_own on public.survey_answers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy survey_update_own on public.survey_answers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy settings_read_own on public.notification_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy settings_insert_own on public.notification_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy settings_update_own on public.notification_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy photos_read_own on public.photos for select to authenticated using ((select auth.uid()) = user_id);
create policy photos_insert_own on public.photos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy photos_delete_own on public.photos for delete to authenticated using ((select auth.uid()) = user_id);
create policy messages_read_own on public.messages for select to authenticated using ((select auth.uid()) = user_id and sent_at is not null);
create policy feedback_read_own on public.feedback for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.users, public.survey_answers, public.photos, public.notification_settings,
  public.messages, public.feedback, public.sky_events, public.llm_usage from anon, authenticated;
grant select on public.users, public.survey_answers, public.photos, public.notification_settings,
  public.messages, public.feedback to authenticated;
grant insert (user_id, priorities, priorities_other, goals, goals_other, putting_off, inspirations, saved_step),
  update (user_id, priorities, priorities_other, goals, goals_other, putting_off, inspirations, saved_step)
  on public.survey_answers to authenticated;
grant insert (user_id, day, time, timezone, channels, paused), update (user_id, day, time, timezone, channels, paused)
  on public.notification_settings to authenticated;
grant insert (id, user_id, storage_path, season_tag), delete on public.photos to authenticated;
grant all on public.users, public.survey_answers, public.photos, public.notification_settings,
  public.messages, public.feedback, public.sky_events, public.llm_usage to service_role;
revoke execute on function public.create_profile(), public.set_updated_at(), public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 5242880, array['image/jpeg']);

create policy memories_read_own on storage.objects for select to authenticated
using (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy memories_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy memories_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'memories' and (storage.foldername(name))[1] = (select auth.uid())::text);
