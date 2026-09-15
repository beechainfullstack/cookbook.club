begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, phone, phone_confirmed_at)
select ('80000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '1415555030' || n, now() from generate_series(1,5) n;
insert into public.schools (id, name, location)
values ('90000000-0000-4000-8000-000000000001', 'Notification Test School', 'City');
insert into public.profiles (id, school_id, display_name)
select id, '90000000-0000-4000-8000-000000000001', 'Person ' || right(phone, 1)
from auth.users where phone like '1415555030%';

do $$
declare
  recipient uuid := '80000000-0000-4000-8000-000000000005';
  entry_id uuid;
  sender public.profiles;
begin
  for sender in select * from public.profiles
    where school_id = '90000000-0000-4000-8000-000000000001' and id <> recipient order by id
  loop
    entry_id := gen_random_uuid();
    insert into public.book_entries (id, school_id, tagged_user_id, tagged_name, flavor)
    values (entry_id, sender.school_id, recipient, 'Recipient',
      case when sender.id = '80000000-0000-4000-8000-000000000003'
        then 'ideas'::public.flavor else 'art'::public.flavor end);
    insert into private.tags (entry_id, tagger_id, tagged_id) values (entry_id, sender.id, recipient);
  end loop;
end $$;

select is((select flavor::text from private.push_outbox), 'ideas',
  'notification keeps the threshold entry flavor after later tags in other flavors');
insert into private.push_tokens (token, user_id)
values ('ExpoPushToken[content_test]', '80000000-0000-4000-8000-000000000005');
set local role service_role;
create temporary table claimed as select * from public.claim_push_deliveries();
select is((select count(*) from claimed), 1::bigint, 'one reveal produces one delivery');
select is((select flavor::text from claimed), 'ideas', 'worker receives the saved reveal flavor');
reset role;

select * from finish();
rollback;
