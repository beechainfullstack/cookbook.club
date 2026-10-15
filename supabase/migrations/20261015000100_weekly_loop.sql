alter table public.notification_settings add constraint valid_push_token
  check (expo_push_token is null or expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$');
grant insert (expo_push_token), update (expo_push_token) on public.notification_settings to authenticated;

alter table public.messages
  add column cycle_key text,
  add column scheduled_for timestamptz not null default now(),
  add column state text not null default 'ready' check (state in ('queued', 'generating', 'ready', 'failed', 'cancelled')),
  add column generation_attempts integer not null default 0,
  add column claimed_at timestamptz,
  add column error_code text,
  add column survey_updated_at timestamptz,
  add constraint messages_user_cycle unique (user_id, cycle_key);
create index messages_work_idx on public.messages(state, scheduled_for) where sent_at is null;
create unique index messages_one_pending_weekly on public.messages(user_id)
  where type = 'weekly' and sent_at is null and state in ('queued', 'generating', 'ready');

create table public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'accepted', 'delivered', 'failed', 'uncertain', 'skipped')),
  attempts integer not null default 0,
  attempted_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  push_token text,
  error_code text,
  created_at timestamptz not null default now(),
  unique (message_id, channel)
);
create index deliveries_pending_idx on public.message_deliveries(status, created_at);
alter table public.message_deliveries enable row level security;
revoke all on public.message_deliveries from anon, authenticated;
grant all on public.message_deliveries to service_role;

alter table public.llm_usage
  add column status text not null default 'completed' check (status in ('reserved', 'completed', 'failed', 'uncertain')),
  add column cache_creation_tokens integer not null default 0 check (cache_creation_tokens >= 0);

create table public.budget_alerts (
  month date primary key,
  sent_at timestamptz,
  claimed_at timestamptz
);
alter table public.budget_alerts enable row level security;
revoke all on public.budget_alerts from anon, authenticated;
grant all on public.budget_alerts to service_role;

create policy feedback_insert_own on public.feedback for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.messages m where m.id = message_id and m.user_id = (select auth.uid()) and m.sent_at is not null
));
create policy feedback_update_own on public.feedback for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.messages m where m.id = message_id and m.user_id = (select auth.uid()) and m.sent_at is not null
));
grant insert (message_id, user_id, rating, comment), update (message_id, user_id, rating, comment)
  on public.feedback to authenticated;

create function public.crisis_signal(value text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(value, '') ~* '(suicid|self[ -]?harm|kill(ing)? myself|end(ing)? my life|hurt(ing)? myself|want to die|do not want to live|don''t want to live|overdos|\mcrisis\M)';
$$;

create function public.hold_unsafe_text() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.crisis_signal(case when tg_table_name = 'feedback' then to_jsonb(new)->>'comment'
    else concat_ws(' ', to_jsonb(new)->>'priorities_other', to_jsonb(new)->>'goals_other',
      to_jsonb(new)->>'putting_off', to_jsonb(new)->>'inspirations') end) then
    update public.users set messaging_hold = true where id = new.user_id;
    update public.messages set state = 'cancelled', error_code = 'safety_hold'
      where user_id = new.user_id and type <> 'safety' and sent_at is null;
  end if;
  return new;
end;
$$;
create trigger survey_safety after insert or update on public.survey_answers
for each row execute function public.hold_unsafe_text();
create trigger feedback_safety after insert or update on public.feedback
for each row execute function public.hold_unsafe_text();

update public.users u set messaging_hold = true where exists (
  select 1 from public.survey_answers a where a.user_id = u.id
    and public.crisis_signal(concat_ws(' ', a.priorities_other, a.goals_other, a.putting_off, a.inspirations))
) or exists (select 1 from public.feedback f where f.user_id = u.id and public.crisis_signal(f.comment));

create function public.next_checkin(day_number integer, local_time time, zone text, after_time timestamptz)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare
  local_date date := (after_time at time zone zone)::date;
  candidate date := local_date + ((day_number - extract(dow from local_date)::integer + 7) % 7);
  result timestamptz;
begin
  result := (candidate + local_time) at time zone zone;
  if result < after_time then result := ((candidate + 7) + local_time) at time zone zone; end if;
  return result;
end;
$$;

create function public.enqueue_weekly(p_user_id uuid default null, p_deliver_now boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  cycle text := to_char(date_trunc('week', now() at time zone 'UTC'), 'YYYY-MM-DD');
  inserted integer;
begin
  insert into public.messages(user_id, type, content, channels, cycle_key, state, scheduled_for, survey_updated_at)
  select u.id, 'weekly', '', s.channels, cycle, 'queued',
    case when p_deliver_now then now() else public.next_checkin(s.day, s.time, s.timezone, now()) end, a.updated_at
  from public.users u join public.notification_settings s on s.user_id = u.id
    join public.survey_answers a on a.user_id = u.id
  where u.onboarding_completed_at is not null and not u.messaging_hold
    and not s.paused and cardinality(s.channels) > 0 and not s.star_mode
    and (p_user_id is null or u.id = p_user_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if p_deliver_now then
    update public.messages set scheduled_for = now()
    where user_id = p_user_id and cycle_key = cycle and sent_at is null and state in ('queued', 'ready');
  end if;
  return inserted;
end;
$$;

create function public.enqueue_safety(p_content text) returns integer
language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  update public.messages m set state = 'cancelled', error_code = 'safety_hold'
  from public.users u where m.user_id = u.id and u.messaging_hold and m.type <> 'safety' and m.sent_at is null;
  insert into public.messages(user_id, type, content, channels, cycle_key, scheduled_for)
  select u.id, 'safety', p_content, s.channels, 'safety', now()
  from public.users u join public.notification_settings s on s.user_id = u.id
  where u.messaging_hold and u.onboarding_completed_at is not null and not s.paused and cardinality(s.channels) > 0
    and not exists (select 1 from public.messages m where m.user_id = u.id and m.type = 'safety')
  on conflict (user_id, cycle_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create function public.claim_generation(p_user_id uuid default null) returns setof public.messages
language sql security definer set search_path = '' as $$
  update public.messages set state = 'generating', claimed_at = now(), generation_attempts = generation_attempts + 1
  where id = (select m.id from public.messages m
    join public.users u on u.id = m.user_id join public.notification_settings s on s.user_id = u.id
    where m.state = 'queued' and m.generation_attempts < 3 and not u.messaging_hold
      and (p_user_id is null or m.user_id = p_user_id)
      and not s.paused and cardinality(s.channels) > 0
    order by m.scheduled_for for update of m skip locked limit 1)
  returning *;
$$;

create function public.reserve_llm(p_message_id uuid, p_model text, p_max_cost numeric, p_budget numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  spent numeric;
  reservation uuid;
begin
  if p_max_cost <= 0 or p_budget <= 0 or p_budget > 40 then raise exception 'Invalid budget'; end if;
  perform pg_catalog.pg_advisory_xact_lock(7152026);
  select coalesce(sum(cost_usd), 0) into spent from public.llm_usage where created_at >= month_start;
  if spent + p_max_cost > p_budget then
    insert into public.budget_alerts(month) values ((month_start at time zone 'UTC')::date) on conflict do nothing;
    return null;
  end if;
  insert into public.llm_usage(user_id, message_id, model, input_tokens, output_tokens, cost_usd, status)
  select user_id, id, p_model, 0, 0, p_max_cost, 'reserved' from public.messages where id = p_message_id
  returning id into reservation;
  return reservation;
end;
$$;

create function public.prepare_deliveries() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages m set state = 'cancelled', error_code = 'survey_changed'
  from public.survey_answers a where m.user_id = a.user_id and m.type <> 'safety'
    and m.state = 'ready' and m.sent_at is null and m.survey_updated_at is distinct from a.updated_at;
  insert into public.message_deliveries(message_id, channel)
  select m.id, channel from public.messages m join public.users u on u.id = m.user_id
    join public.notification_settings s on s.user_id = u.id, unnest(m.channels) channel
  where m.state = 'ready' and m.scheduled_for <= now() and m.scheduled_for > now() - interval '23 hours'
    and not s.paused and cardinality(s.channels) > 0 and channel = any(s.channels)
    and (not u.messaging_hold or m.type = 'safety')
  on conflict do nothing;
  update public.messages set state = 'failed', error_code = 'generation_interrupted'
    where state = 'generating' and claimed_at < now() - interval '10 minutes';
  update public.message_deliveries set status = case when channel = 'email' and attempts < 3
      and created_at > now() - interval '23 hours' then 'pending' else 'uncertain' end,
      error_code = 'delivery_interrupted'
    where status = 'sending' and attempted_at < now() - interval '10 minutes';
end;
$$;

create function public.claim_delivery(p_user_id uuid default null) returns setof public.message_deliveries
language sql security definer set search_path = '' as $$
  update public.message_deliveries set status = 'sending', attempts = attempts + 1, attempted_at = now()
  where id = (select d.id from public.message_deliveries d join public.messages m on m.id = d.message_id
    where d.status = 'pending' and d.attempts < 3 and d.next_attempt_at <= now() and m.scheduled_for > now() - interval '23 hours'
      and (p_user_id is null or m.user_id = p_user_id)
    order by d.created_at for update of d skip locked limit 1)
  returning *;
$$;

create function public.claim_budget_alert() returns setof public.budget_alerts
language sql security definer set search_path = '' as $$
  update public.budget_alerts set claimed_at = now() where month = (
    select month from public.budget_alerts where sent_at is null and (claimed_at is null or claimed_at < now() - interval '10 minutes')
    order by month desc for update skip locked limit 1)
  returning *;
$$;

revoke execute on function public.crisis_signal(text), public.hold_unsafe_text(), public.next_checkin(integer,time,text,timestamptz),
  public.enqueue_weekly(uuid,boolean), public.enqueue_safety(text), public.claim_generation(uuid),
  public.reserve_llm(uuid,text,numeric,numeric), public.prepare_deliveries(), public.claim_delivery(uuid), public.claim_budget_alert()
  from public, anon, authenticated;
grant execute on function public.crisis_signal(text), public.next_checkin(integer,time,text,timestamptz),
  public.enqueue_weekly(uuid,boolean), public.enqueue_safety(text), public.claim_generation(uuid),
  public.reserve_llm(uuid,text,numeric,numeric), public.prepare_deliveries(), public.claim_delivery(uuid), public.claim_budget_alert()
  to service_role;
