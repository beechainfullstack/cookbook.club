begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, phone, phone_confirmed_at) values
('00000000-0000-4000-8000-000000000001', '14155550101', now()),
('00000000-0000-4000-8000-000000000002', '14155550102', now()),
('00000000-0000-4000-8000-000000000003', '14155550103', now()),
('00000000-0000-4000-8000-000000000004', '14155550104', now()),
('00000000-0000-4000-8000-000000000005', '14155550105', now()),
('00000000-0000-4000-8000-000000000006', '14155550106', now()),
('00000000-0000-4000-8000-000000000007', '14155550107', null);
insert into public.schools (id, name, location) values
('10000000-0000-4000-8000-000000000001', 'School A', 'City A'),
('10000000-0000-4000-8000-000000000002', 'School B', 'City B');
insert into private.school_codes (school_id, code_hash, expires_at, uses_remaining) values
('10000000-0000-4000-8000-000000000001', encode(extensions.digest('test-school-code', 'sha256'), 'hex'), now() + interval '1 day', 100);
insert into public.profiles (id, school_id, display_name)
select id, '10000000-0000-4000-8000-000000000001', 'Person ' || right(phone, 1) from auth.users
where id::text in (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004');
insert into public.profiles (id, school_id, display_name) values
('00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Other School');

set local role anon;
select throws_ok('select * from public.book_entries', '42501', null, 'anonymous users cannot read the Book');
select throws_ok($$select public.get_contacts()$$, '42501', null, 'anonymous users cannot call contacts RPC');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}';
select is((select count(*) from public.book_entries), 0::bigint, 'unverified users have no feed');
select throws_ok($$select public.enroll(current_date - interval '12 years', 'Young User', '10000000-0000-4000-8000-000000000001', 'test-school-code')$$,
  '42883', null, 'enrollment accepts dates, not ambiguous timestamps');
select throws_ok($$select public.enroll((current_date - interval '12 years')::date, 'Young User', '10000000-0000-4000-8000-000000000001', 'test-school-code')$$,
  'P0001', 'AGE_BLOCKED', 'server blocks under 13');
select throws_ok($$select public.enroll(date '2010-01-01', 'Student', '10000000-0000-4000-8000-000000000001', 'wrong-code')$$,
  'P0001', 'INVALID_SCHOOL_CODE', 'school selection alone is not verification');
select lives_ok($$select public.enroll((current_date - interval '13 years')::date, 'Student', '10000000-0000-4000-8000-000000000001', 'test-school-code')$$,
  'exactly 13 can enroll with a valid school code');
select is((select school_id::text from public.enroll(date '2010-01-01', 'Changed Name', '10000000-0000-4000-8000-000000000002', 'wrong')),
  '10000000-0000-4000-8000-000000000001', 'repeated enrollment cannot switch school');
select throws_ok($$update public.profiles set school_id = '10000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'client cannot change membership directly');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated"}';
select throws_ok($$select public.enroll(date '2010-01-01', 'Student', '10000000-0000-4000-8000-000000000001', 'test-school-code')$$,
  'P0001', 'NOT_AUTHORIZED', 'phone must be verified');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.sync_contacts(array['+14155550102', '+14155550105', '+14155550101', '+14155550999'])),
  1::bigint, 'matches only registered contacts at the same school, excluding self');
select throws_ok($$select * from private.tags$$, '42501', null, 'raw sender identities are private');
select throws_ok($$select * from private.school_codes$$, '42501', null, 'school code hashes are private');
select throws_ok($$select public.claim_push_deliveries()$$, '42501', null, 'push worker is service-role only');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000003', 'art', gen_random_uuid())$$,
  'P0001', 'CONTACT_REQUIRED', 'cannot tag same-school non-contacts');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000005', 'art', gen_random_uuid())$$,
  'P0001', 'CONTACT_REQUIRED', 'cannot tag across schools');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000001', 'art', gen_random_uuid())$$,
  'P0001', 'CONTACT_REQUIRED', 'cannot tag yourself');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000002', 'roast', gen_random_uuid())$$,
  '22P02', null, 'only approved positive flavors are accepted');
select throws_ok($$insert into public.book_entries (id,school_id,tagged_user_id,tagged_name,flavor)
  values(gen_random_uuid(),'10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Forged','art')$$,
  '42501', null, 'direct entry writes cannot bypass tagging rules');
select lives_ok($$select public.create_tag('00000000-0000-4000-8000-000000000002', 'art', '20000000-0000-4000-8000-000000000001')$$,
  'can tag before ever receiving a tag');
select is((select cardinality(tagger_user_ids) from public.book_entries limit 1), 0, 'unrevealed API records contain no tagger IDs');
select is((select cardinality(tagger_names) from public.book_entries limit 1), 0, 'unrevealed API records contain no tagger names');
select lives_ok($$select public.create_tag('00000000-0000-4000-8000-000000000002', 'art', '20000000-0000-4000-8000-000000000001')$$,
  'network retry with same request ID is idempotent');
select is((select count(*) from public.book_entries), 1::bigint, 'retry creates exactly one entry');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000002', 'art', gen_random_uuid())$$,
  'P0001', 'RATE_LIMITED', 'new rapid duplicate tags are rate limited');
select lives_ok($$select public.sync_contacts('{}'::text[])$$, 'can replace contact graph with an empty sync');
select throws_ok($$select public.create_tag('00000000-0000-4000-8000-000000000002', 'art', gen_random_uuid())$$,
  'P0001', 'CONTACT_REQUIRED', 'removed contacts are no longer taggable');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*) from public.get_book()), 1::bigint, 'school Book includes entries outside viewer contacts');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*) from public.get_book()), 0::bigint, 'other school cannot browse entries');
select is((select count(*) from public.profiles), 1::bigint, 'profiles are school scoped too');
reset role;
select is((select count(*) from private.push_outbox), 0::bigint, 'no notification before a reveal');
select * from finish();
rollback;
