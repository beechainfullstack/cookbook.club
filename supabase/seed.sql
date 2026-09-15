insert into public.schools (id, name, location)
values ('10000000-0000-4000-8000-000000000099', 'Local Test High School', 'Local development')
on conflict do nothing;

insert into private.school_codes (school_id, code_hash, expires_at, uses_remaining)
values (
  '10000000-0000-4000-8000-000000000099',
  encode(extensions.digest('local-school-code', 'sha256'), 'hex'),
  now() + interval '1 year',
  1000
) on conflict do nothing;
