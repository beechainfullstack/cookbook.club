begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select is(public.next_checkin(0, '02:30', 'America/New_York', '2026-03-08 00:00Z'), '2026-03-08 07:30Z'::timestamptz, 'spring DST gap moves forward');
select is(public.next_checkin(0, '01:30', 'America/New_York', '2026-11-01 00:00Z'), '2026-11-01 06:30Z'::timestamptz, 'fall DST chooses one instant');
select is(public.next_checkin(1, '09:00', 'UTC', '2026-10-12 10:00Z'), '2026-10-19 09:00Z'::timestamptz, 'past local slot moves to next week');
select ok(public.crisis_signal('I want to hurt myself'), 'crisis signal is recognized');
select ok(not public.crisis_signal('I enjoy music'), 'ordinary inspiration is not a crisis signal');
select is((select count(*)::integer from cron.job where jobname in ('slow-weekly-batch', 'slow-weekly-worker')), 2, 'both cron jobs exist');
select ok(not has_table_privilege('authenticated', 'public.message_deliveries', 'SELECT'), 'delivery records are server-only');
select ok(not has_table_privilege('anon', 'public.budget_alerts', 'SELECT'), 'budget alerts are private');
select ok(not has_function_privilege('authenticated', 'public.enqueue_weekly(uuid,boolean)', 'EXECUTE'), 'clients cannot request generation');
select ok(not has_function_privilege('authenticated', 'public.reserve_llm(uuid,text,numeric,numeric)', 'EXECUTE'), 'clients cannot change budget ledger');
select ok(not has_function_privilege('anon', 'public.invoke_weekly_worker()', 'EXECUTE'), 'anonymous callers cannot invoke the cron worker');

insert into auth.users(id,email) values ('aaaaaaaa-1111-4111-8111-111111111111','phase-two@tests.invalid');
insert into public.survey_answers(user_id, inspirations) values ('aaaaaaaa-1111-4111-8111-111111111111','Music');
insert into public.notification_settings(user_id) values ('aaaaaaaa-1111-4111-8111-111111111111');
insert into public.messages(id,user_id,type,content,sent_at) values
  ('aaaaaaaa-2222-4222-8222-222222222222','aaaaaaaa-1111-4111-8111-111111111111','weekly','A sent note.',now()),
  ('aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-1111-4111-8111-111111111111','weekly','An unsent note.',null);
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$insert into public.feedback(user_id,message_id,rating) values ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-2222-4222-8222-222222222222',1)$$, 'can rate a sent own note');
select lives_ok($$update public.feedback set rating = -1, comment = 'Less of this theme'$$, 'can edit own rating and comment');
select throws_ok($$insert into public.feedback(user_id,message_id,rating) values ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',1)$$,'42501',null,'cannot rate an unsent note');
select throws_ok($$update public.feedback set comment = repeat('x',281)$$,'23514',null,'feedback is limited to one short comment');
select throws_ok($$update public.notification_settings set expo_push_token = 'not-a-token'$$,'23514',null,'push token format is checked');
select lives_ok($$update public.survey_answers set putting_off = 'I want to hurt myself'$$, 'unsafe free text can be saved without a client-side bypass');
reset role;
select ok((select messaging_hold from public.users where id = 'aaaaaaaa-1111-4111-8111-111111111111'), 'unsafe free text sets a server hold');
select is((select state from public.messages where id = 'aaaaaaaa-3333-4333-8333-333333333333'), 'cancelled', 'unsafe free text cancels unsent normal messaging');
select * from finish();
rollback;
