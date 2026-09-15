begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, phone, phone_confirmed_at)
select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '1415555020' || n, now() from generate_series(1,5) n;
insert into public.schools (id, name, location) values ('10000000-0000-4000-8000-000000000001', 'School', 'City');
insert into public.profiles (id, school_id, display_name)
select id, '10000000-0000-4000-8000-000000000001', 'Person ' || right(phone, 1) from auth.users
where phone like '1415555020%';
insert into private.contacts (owner_id, contact_id)
select id, '00000000-0000-4000-8000-000000000005' from public.profiles where id <> '00000000-0000-4000-8000-000000000005';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin perform public.create_tag('00000000-0000-4000-8000-000000000005','art','20000000-0000-4000-8000-000000000001'); end $$;
reset role;
update private.tags set created_at = now() - interval '30 days';
set local role authenticated;
do $$ begin perform public.create_tag('00000000-0000-4000-8000-000000000005','sports','20000000-0000-4000-8000-000000000002'); end $$;
select is((select count(*) from public.book_entries where revealed), 0::bigint, 'repeat tagger counts once across flavors and all time');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin perform public.create_tag('00000000-0000-4000-8000-000000000005','style','20000000-0000-4000-8000-000000000003'); end $$;
select is((select count(*) from public.book_entries where revealed), 0::bigint, 'three tags from two people stay anonymous');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin perform public.create_tag('00000000-0000-4000-8000-000000000005','music','20000000-0000-4000-8000-000000000004'); end $$;
select is((select count(*) from public.book_entries where revealed), 4::bigint, 'third distinct person reveals every existing entry for recipient');
select is((select tagger_names from public.book_entries limit 1), array['Person 1','Person 2','Person 3'], 'reveal shows the first three distinct names in chronological order');
select is((select cardinality(tagger_user_ids) from public.book_entries limit 1), 3, 'revealed entry saves three distinct user IDs');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$ begin perform public.create_tag('00000000-0000-4000-8000-000000000005','ideas','20000000-0000-4000-8000-000000000005'); end $$;
select is((select count(*) from public.book_entries where revealed), 5::bigint, 'later entries inherit the permanent reveal');
select is((select tagger_names from public.book_entries where id = '20000000-0000-4000-8000-000000000005'),
  array['Person 1','Person 2','Person 3'], 'later taggers do not change the original reveal group');
select is((select count(*) from public.get_book()), 5::bigint, 'entries remain permanently browseable');
reset role;
select is((select count(*) from private.push_outbox), 1::bigint, 'one transactional notification event per recipient');
insert into private.push_tokens (token, user_id) values ('ExpoPushToken[test_token]', '00000000-0000-4000-8000-000000000005');
set local role service_role;
select is((select count(*) from public.claim_push_deliveries()), 1::bigint, 'worker claims one notification delivery');
select is((select count(*) from public.claim_push_deliveries()), 0::bigint, 'active lease prevents duplicate claims');
reset role;
do $$ declare d private.push_deliveries; begin
  select * into d from private.push_deliveries limit 1;
  perform public.finish_push_delivery(d.id, gen_random_uuid(), 'stale-worker-ticket');
end $$;
select is((select count(*) from private.push_deliveries where sent_at is not null), 0::bigint, 'stale lease cannot acknowledge a newer worker');
do $$ declare d private.push_deliveries; begin
  select * into d from private.push_deliveries limit 1;
  perform public.finish_push_delivery(d.id, d.lease_id, 'accepted-ticket');
end $$;
set local role service_role;
select is((select count(*) from public.claim_push_deliveries()), 0::bigint, 'accepted deliveries are not resent');
reset role;
select * from finish();
rollback;
