create or replace function public.enqueue_weekly(p_user_id uuid default null, p_deliver_now boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  cycle text := to_char(date_trunc('week', now() at time zone 'UTC'), 'YYYY-MM-DD');
  inserted integer;
begin
  update public.messages set state = 'cancelled', error_code = 'delivery_window_expired'
    where state in ('queued', 'ready') and sent_at is null and scheduled_for <= now() - interval '23 hours';
  insert into public.messages(user_id, type, content, channels, cycle_key, state, scheduled_for, survey_updated_at)
  select u.id, 'weekly', '', s.channels, cycle, 'queued',
    case when p_deliver_now then now() else public.next_checkin(s.day, s.time, s.timezone, now()) end, a.updated_at
  from public.users u join public.notification_settings s on s.user_id = u.id
    join public.survey_answers a on a.user_id = u.id
  where u.onboarding_completed_at is not null and not u.messaging_hold
    and not s.paused and ('email' = any(s.channels) or ('push' = any(s.channels) and s.expo_push_token is not null)) and not s.star_mode
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

create or replace function public.enqueue_safety(p_content text) returns integer
language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  update public.messages m set state = 'cancelled', error_code = 'safety_hold'
  from public.users u where m.user_id = u.id and u.messaging_hold and m.type <> 'safety' and m.sent_at is null;
  insert into public.messages(user_id, type, content, channels, cycle_key, scheduled_for)
  select u.id, 'safety', p_content, s.channels, 'safety', now()
  from public.users u join public.notification_settings s on s.user_id = u.id
  where u.messaging_hold and u.onboarding_completed_at is not null and not s.paused and ('email' = any(s.channels) or ('push' = any(s.channels) and s.expo_push_token is not null))
    and not exists (select 1 from public.messages m where m.user_id = u.id and m.type = 'safety')
  on conflict (user_id, cycle_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.claim_generation(p_user_id uuid default null) returns setof public.messages
language sql security definer set search_path = '' as $$
  update public.messages set state = 'generating', claimed_at = now(), generation_attempts = generation_attempts + 1
  where id = (select m.id from public.messages m
    join public.users u on u.id = m.user_id join public.notification_settings s on s.user_id = u.id
    where m.state = 'queued' and m.scheduled_for > now() - interval '23 hours' and m.generation_attempts < 3 and not u.messaging_hold
      and (p_user_id is null or m.user_id = p_user_id)
      and not s.paused and ('email' = any(s.channels) or ('push' = any(s.channels) and s.expo_push_token is not null))
    order by m.scheduled_for for update of m skip locked limit 1)
  returning *;
$$;

create or replace function public.prepare_deliveries() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set state = 'cancelled', error_code = 'delivery_window_expired'
    where state in ('queued', 'ready') and sent_at is null and scheduled_for <= now() - interval '23 hours';
  update public.message_deliveries d set status = 'skipped', error_code = 'delivery_window_expired'
    from public.messages m where m.id = d.message_id and d.status = 'pending'
      and m.scheduled_for <= now() - interval '23 hours';
  update public.messages m set state = 'cancelled', error_code = 'survey_changed'
  from public.survey_answers a where m.user_id = a.user_id and m.type <> 'safety'
    and m.state = 'ready' and m.sent_at is null and m.survey_updated_at is distinct from a.updated_at;
  insert into public.message_deliveries(message_id, channel)
  select m.id, channel from public.messages m join public.users u on u.id = m.user_id
    join public.notification_settings s on s.user_id = u.id, unnest(s.channels) channel
  where m.state = 'ready' and m.scheduled_for <= now() and m.scheduled_for > now() - interval '23 hours'
    and not s.paused and ('email' = any(s.channels) or ('push' = any(s.channels) and s.expo_push_token is not null)) and (channel <> 'push' or s.expo_push_token is not null)
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
