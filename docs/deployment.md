# Deploying cookbook.club

## 1. Hosted backend

Create a Supabase project and enable the Phone provider under Authentication. Configure a supported real SMS provider and require phone confirmation. Set the SMS template from `copy.json` → `notifications.sms`, retaining `{{ .Code }}`. Configure provider rate limits for your rollout.

The committed Supabase config is **local development configuration**, including fixed test OTPs and a dummy SMS provider. Use migrations to deploy the schema; configure hosted authentication separately.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`db push` applies the schema migration and Realtime publication. Do not include the local seed in a hosted deployment.

## 2. Verified schools

Use the Supabase SQL Editor as an administrator. Generate a unique, high-entropy access code (for example, `openssl rand -hex 16`) and distribute it through a school-controlled channel. Substitute the school's details and the newly generated code:

```sql
with school as (
  insert into public.schools (name, location)
  values ('YOUR SCHOOL', 'CITY, STATE')
  returning id
)
insert into private.school_codes (school_id, code_hash, expires_at, uses_remaining)
select id,
  encode(extensions.digest('YOUR GENERATED CODE', 'sha256'), 'hex'),
  now() + interval '30 days',
  500
from school;
```

Only the hash is stored. Codes expire and have a finite use count. Use separate short-lived codes for smaller enrollment groups if appropriate. Existing membership cannot be edited from the app; school transfers and account removal require an administrative procedure. Permanent Book references intentionally prevent accidental deletion of users with recognition history.

## 3. Expo project

Use an Expo account and an EAS CLI compatible with `eas.json`.

```sh
eas login
eas init
```

Configure these public build variables in the EAS project:

- `EXPO_PUBLIC_SUPABASE_URL`: hosted project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: public anon key
- `EXPO_PUBLIC_EAS_PROJECT_ID`: EAS project UUID
- `EXPO_PUBLIC_DEMO_MODE`: `false`

Service-role keys, SMS credentials, and the push worker secret must never be `EXPO_PUBLIC_*` values. Provision APNs and FCM v1 credentials through EAS for the iOS/Android app identifiers in `app.config.ts`.

```sh
eas build --profile development --platform all
# After physical-device validation:
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

App-store accounts, signing, and store metadata are release inputs. The supplied product copy is bundled; review the remaining supporting interface copy before release.

## 4. Reveal push worker

The database trigger writes the outbox in the same transaction as the reveal. Deploy the dispatcher and schedule it every minute. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside Edge Functions.

Create a strong random `PUSH_WORKER_SECRET` and save it as an Edge Function secret. If Expo push security is enabled, save `EXPO_ACCESS_TOKEN` too. Use a private, ignored env file:

```sh
npx supabase secrets set --env-file .env.worker
npx supabase functions deploy dispatch-reveals
```

The function uses its own bearer secret; platform JWT verification is disabled specifically for this function in `supabase/config.toml`. It accepts POST requests only.

In Supabase, enable the `pg_cron`, `pg_net`, and Vault extensions, then store the function URL and the same worker secret in Vault:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/dispatch-reveals',
  'cookbook_push_url'
);
select vault.create_secret('YOUR_PUSH_WORKER_SECRET', 'cookbook_push_secret');

select cron.schedule(
  'cookbook-reveals',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cookbook_push_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cookbook_push_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
```

Invoke once to check the deployed worker:

```sh
curl --fail-with-body -X POST \
  "$SUPABASE_URL/functions/v1/dispatch-reveals" \
  -H "Authorization: Bearer $PUSH_WORKER_SECRET"
```

The worker claims up to 100 device deliveries, leases them for five minutes, backs off after failures, and stops after eight attempts. Jobs are associated with the recipient and current device owner. Sign-out unregisters the device token. Tokens registered within seven days of a reveal can receive the pending notification.

`sent_at` means **accepted by Expo**, not confirmed delivery by APNs/FCM. The MVP stores Expo ticket IDs but does not poll push receipts; inspect Expo/Supabase logs when validating on devices. A crash after Expo acceptance but before acknowledgment may result in a duplicate notification; delivery is at least once.

## 5. Physical-device acceptance

Use four verified accounts at a test school. Put the recipient's phone number in the other three devices' contacts. Sync, submit a tag, and confirm that the entire school can browse the entry while only synced contacts can tag. A repeated sender must not reveal; the third distinct sender must reveal all recipient entries and produce the notification. Tap the notification and confirm the recipient's page opens. Verify a second school cannot read those entries.

Also verify the under-13 block, invalid OTP and school-code errors, denied contacts permission, contact removal after resync, and notification permission denial. The web preview cannot validate these native integrations.
