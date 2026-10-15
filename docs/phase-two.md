# Phase 2: weekly notes

## What runs

- `slow-weekly-batch` creates one durable queue entry per eligible user every
  Monday at 00:00 UTC. It never calls Claude from the app or on normal app opens.
- `slow-weekly-worker` runs every five minutes. It resumes that batch in small
  chunks, delivers notes at each user's selected local day/time, checks Expo
  receipts, and sends budget alerts. Generation is one weekly batch, resumed
  across bounded Edge invocations, not a new generation job every five minutes.
- Local times use Postgres IANA timezones, including DST. Delivery can be up to
  five minutes late in normal operation. A spring-forward nonexistent local
  time moves forward; a repeated fall-back time is sent once.
- There is one pending weekly note per user and one message per UTC batch week.
  Retrying a job does not regenerate an existing note. Delivery suppresses any
  different weekly note sent in the preceding six days. Missed delivery windows
  expire after 23 hours rather than sending a backlog.
- Paused users and users with neither channel enabled are skipped. Preferences,
  survey version, and safety holds are checked again immediately before sending.
  Editing a survey after generation cancels an unsent note, rather than sending
  stale context. The updated survey is used in the next weekly batch.

The small model is pinned to `claude-haiku-4-5-20251001`; there is no automatic
model/service fallback. Only weekly and safety notes run in Phase 2. Seasonal
notes, reminders, computed sky-event jobs, star mode, and photo resurfacing stay
out of scope. Existing server-owned `sky_events` rows, if present, are passed as
computed context; an empty table means no sky claims are allowed in the prompt.

## Spending and safety

Set `MONTHLY_LLM_BUDGET_USD` explicitly (recommended **10**, accepted range
**greater than 0 to 40**). Missing or invalid configuration fails closed.
Before each generation, the worker counts tokens with Anthropic's free token
counter and atomically reserves a conservative maximum cost in Postgres. The
reservation includes cache-write pricing, output limits, and an input-count
margin. Concurrent workers share the same monthly ledger. Normal completion
records input/output/cache tokens and actual estimated cost. Invalid generated
notes are still charged and logged, not silently replaced or regenerated.

Reserved/uncertain calls count against the budget at their maximum estimate;
crashes or ambiguous timeouts never release them automatically. Known rejected
4xx requests cost zero. Review uncertain records against the provider invoice
before manually correcting them. The worker stops before the next reservation
would exceed the limit and sends an email to `ADMIN_ALERT_EMAIL`. A pending
budget alert is retried with a stable Resend idempotency key. Existing notes and
the fixed safety resource can still be delivered without a new LLM call.

The system prompt is identical across users and uses an ephemeral cache marker.
Cache hits depend on Anthropic's model-specific minimum prefix length; a short
beta prompt may not meet it. Estimates do **not** assume cache discounts.
Haiku pricing used: **$1/M input**, **$5/M output**, **$1.25/M cache-write**,
**$0.10/M cache-read**. Revalidate prices before changing models.

Survey/feedback writes have a conservative server-side crisis keyword hold.
Claude also assesses supplied free text, including indirect crisis statements,
before writing a weekly note. A detected crisis holds regular messaging and
queues one fixed resource note (988 in the US/Canada, local emergency services,
and findahelpline.com elsewhere). It honors pause/channel preferences and is not
repeated weekly. Holds are server-owned and require deliberate administrator
review before clearing. Automated detection is not clinical monitoring or an
emergency response service and cannot guarantee detection in every language.

## Hosted activation (not performed automatically)

1. Choose the existing Supabase project; inspect its migration history before
   running `npx supabase link --project-ref YOUR_REF` and `npx supabase db push`.
   The migrations add pg_cron/pg_net jobs, but outbound work is inert until the
   two Vault secrets below exist. Do not put secrets in migration files.
2. Copy `supabase/functions/.env.example` to `.env.local` in that directory.
   Provide Anthropic and Resend keys, a verified sender, your alert email,
   budget, and **two different** random secrets (32+ characters each).
   Supabase injects its server URL and service-role key into Edge Runtime.
3. Publish the Expo web export (`npm run build:web`) on your chosen HTTPS host,
   and set `FEEDBACK_WEB_URL` to that app's public URL. No extra paid host is
   required or provisioned here. Email feedback uses this same Expo app without
   login, not an Edge Function HTML page. Supabase's default function gateway
   is not relied on to serve HTML. The public app config must point at the
   same Supabase project as the worker.
4. Set server secrets with `npx supabase secrets set --env-file
   supabase/functions/.env.local`. Never commit the file. Deploy with
   `npx supabase functions deploy weekly-worker` and
   `npx supabase functions deploy email-feedback`. Both functions intentionally
   disable gateway JWT verification: the worker requires its private job
   secret; email feedback requires a signed, message-scoped bearer token.
5. In Supabase's **Vault UI**, create `slow_project_url` (the project's HTTPS
   URL) and `slow_job_secret` (exactly `SLOW_JOB_SECRET`). The cron SQL reads
   Vault at runtime, so rotation does not require editing a migration. Do not
   paste secret-bearing SQL or curl commands into shell history/logs.
6. Set the app's public Supabase values and `EXPO_PUBLIC_EAS_PROJECT_ID`.
   Configure EAS push credentials (FCM v1 for Android, APNs for iOS) and use an
   EAS **development build**, not Expo Go, for live push verification. An Expo
   project ID alone does not configure FCM/APNs. Store beta releases remain
   Phase 3; none are created here. Expo enhanced push security can optionally
   use a server `EXPO_ACCESS_TOKEN`.
7. Open the app, enable push, grant permission, and save. This registers a real
   Expo token; email defaults on. There is one active device token per user in
   this small beta. Opening a different device with push enabled replaces it.
   Token refresh is attempted without asking for permission again; sign-out
   detaches this device's token without erasing another device's registration.

### Manual acceptance send

Use a fully onboarded, unpaused test account with both channels enabled and a
registered development-build token. The following invokes the **same** batch
and delivery pipeline, scoped to that one account, with its schedule due now:

```sh
node --env-file=.env --env-file=supabase/functions/.env.local scripts/send-checkin.mjs USER_UUID
```

The UUID is in Supabase Auth/Studio. Repeating the command reuses this week's
message; it does not generate a second one. Provider requests can take a minute;
the scheduled worker resumes remaining work if the invocation ends. To exercise
another week in local tests, use disposable fixtures, not production edits.

Receive the same note in push and email. Give thumbs feedback in the app, then
open an email feedback link in a signed-out browser and save a rating/comment.
Inspect `messages`, `message_deliveries`, `feedback`, and `llm_usage` in Studio.
An email click only opens a form: **GET never writes feedback**, so link scanners
cannot vote. Tokens bind user/message/30-day expiry; changing the rating updates
the same feedback row. The token is in a URL fragment and removed from browser
history as the page opens. Forwarding an email delegates feedback access for
that message until expiry; rotating the signing secret invalidates old links.

### Delivery behavior

The `send(user, message, channel)` interface keeps future channels isolated.
Content is generated once, persisted, then reused verbatim by both adapters;
email adds only feedback links. Each channel has a separate durable outbox row.
Email retries use a stable Resend key and identical payload within its 24-hour
idempotency window. Retry windows stop at 23 hours. Known 429 rejections retry
with backoff. Ambiguous push timeouts are **not** blindly retried because Expo
has no idempotency key; their status is `uncertain` for operator review.
Interrupted email attempts can retry safely; interrupted push attempts cannot.
Expo receipts are checked after 15 minutes. `DeviceNotRegistered` removes the
matching token only, so a newer device registration is not accidentally erased.
`accepted` means accepted by the provider, not proof a human read the note.
No third-party notification service can guarantee delivery to an offline device.

## Local verification

Apply migrations to the existing disposable local stack without resetting user
data: `npx supabase migration up --local`. Install Deno 2 for Edge checks.

```sh
npm test
npm run typecheck
npm run lint
npm run typecheck:edge
npm run lint:edge
npm run test:db
npm run test:integration
npm run test:weekly
npx supabase db lint --local --level error
npm run build:mobile
npm run build:web
```

`test:weekly` uses the **real local database** and isolated provider test doubles
for Anthropic, Resend, and Expo HTTP requests. It creates temporary accounts and
cleans them up. It proves queue/cost/retry/feedback behavior, not live Claude
quality, inbox arrival, or device receipt. No alternate provider is substituted
in the running app. Production endpoints are fixed in the adapters; test HTTP
injection is available only to the programmatic test harness.

## Expected beta costs

For 50 users × about 4.35 notes/month, at 5,000 input + 250 output tokens/note,
Haiku is approximately **$1.36/month**, before cache discounts. A $10 LLM cap is
deliberately conservative and includes failed/uncertain generation reservations.
Resend's free 100-emails/day allowance covers a 50-person weekly batch plus
normal beta auth traffic if other applications do not share the quota. Confirm
current provider quotas and account billing; optional reminder/seasonal traffic
is not enabled. Expo push has no per-message fee. Supabase Free may suffice;
optional Pro is about $25/month. Expected service total is approximately
**$2/month free-tier**, or **$27/month with Supabase Pro**, excluding an existing
domain and development-build/store memberships. With the recommended LLM cap,
Pro + LLM remains about $35/month before optional services. No paid plan has
been activated. Any additional paid service requires Bee's approval.

Phase 3 remains untouched: no store releases, privacy-policy page, account
deletion UI, or TestFlight/Google Play testing-track setup.

## Official references

- [Claude models](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo send/receipts](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions)
