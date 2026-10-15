create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.invoke_weekly_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  job_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'slow_project_url';
  select decrypted_secret into job_secret from vault.decrypted_secrets where name = 'slow_job_secret';
  if project_url is null or job_secret is null then return; end if;
  perform net.http_post(
    url := project_url || '/functions/v1/weekly-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-slow-job-secret', job_secret),
    body := '{"action":"work"}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function public.invoke_weekly_worker() from public, anon, authenticated;
grant execute on function public.invoke_weekly_worker() to service_role;

select cron.schedule('slow-weekly-batch', '0 0 * * 1', 'select public.enqueue_weekly()');
select cron.schedule('slow-weekly-worker', '*/5 * * * *', 'select public.invoke_weekly_worker()');
