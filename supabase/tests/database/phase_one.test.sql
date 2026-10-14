begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(id, email) values
('11111111-1111-4111-8111-111111111111', 'first@phase-one.test'),
('22222222-2222-4222-8222-222222222222', 'second@phase-one.test');

select is((select count(*)::integer from public.users), 2, 'auth trigger creates profiles');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('users', 'survey_answers', 'photos', 'messages', 'feedback', 'notification_settings', 'sky_events', 'llm_usage') and c.relrowsecurity), 8, 'all eight tables have RLS');
select is((select public from storage.buckets where id = 'memories'), false, 'photo bucket is private');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::integer from public.users), 1, 'can only see own profile');
select throws_ok($$select public.complete_onboarding()$$, 'P0001', 'Finish the survey and notification settings first', 'cannot skip onboarding');
select lives_ok($$insert into public.survey_answers(user_id, priorities, goals, inspirations, saved_step) values ('11111111-1111-4111-8111-111111111111', array['hobbies'], array['health'], 'Music', 4)$$, 'can save own survey');
select throws_ok($$insert into public.survey_answers(user_id) values ('22222222-2222-4222-8222-222222222222')$$, '42501', null, 'cannot write another user survey');
select throws_ok($$update public.survey_answers set priorities = array['unknown']$$, '23514', null, 'unknown survey options rejected');
select lives_ok($$insert into public.notification_settings(user_id, channels) values ('11111111-1111-4111-8111-111111111111', '{}')$$, 'all channels off is valid');
select throws_ok($$update public.notification_settings set day = 7$$, '23514', null, 'invalid day rejected');
select throws_ok($$update public.notification_settings set timezone = 'invalid/zone'$$, '23514', null, 'invalid timezone rejected');
select throws_ok($$update public.notification_settings set channels = array['sms']$$, '23514', null, 'SMS not allowed');
select throws_ok($$update public.notification_settings set star_mode = true$$, '42501', null, 'star mode is server-owned');
select throws_ok($$update public.users set messaging_hold = false$$, '42501', null, 'safety hold is server-owned');
select throws_ok($$update public.users set onboarding_completed_at = now()$$, '42501', null, 'completion cannot be spoofed');
select lives_ok($$select public.complete_onboarding()$$, 'valid onboarding completes');
select ok((select onboarding_completed_at is not null from public.users), 'completion timestamp saved');
select throws_ok($$insert into public.messages(user_id, type, content) values ('11111111-1111-4111-8111-111111111111', 'weekly', 'Forged note')$$, '42501', null, 'clients cannot forge messages');
select throws_ok($$select * from public.llm_usage$$, '42501', null, 'clients cannot read usage ledger');
select throws_ok($$insert into public.photos(id, user_id, storage_path, season_tag) values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg', 'summer')$$, '23514', null, 'photo paths must match owner and ID');

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::integer from public.survey_answers), 0, 'second user cannot see first survey');
select is((select count(*)::integer from public.notification_settings), 0, 'second user cannot see first settings');

reset role;
select ok(not has_table_privilege('anon', 'public.survey_answers', 'SELECT'), 'anonymous role cannot read surveys');
select throws_ok($$insert into public.llm_usage(model, input_tokens, output_tokens, cost_usd) values ('test', 0, 0, -1)$$, '23514', null, 'negative estimated cost rejected');
select * from finish();
rollback;
