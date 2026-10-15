# Slow · Phases 1–2

A calm, personal check-in app for iOS and Android. Expo SDK 54, React Native,
TypeScript, and Supabase. Sign-in, survey, notification preferences, minimal
home, and a durable weekly message loop. See [Phase 2 setup, guardrails, manual
send, and costs](docs/phase-two.md). Live delivery requires your provider/project
configuration; it is not enabled by installing the app. Phase 3 is not included.

## Run locally (free)

Prerequisites: Node.js 24 LTS, npm, Docker running, and Expo Go **for SDK 54**
or an Expo development build. The pinned Supabase CLI is installed by `npm ci`.

```sh
npm ci
npm run db:start
node scripts/setup-local.mjs
npm start -- --go
```

The setup script writes an ignored `.env` using the local anonymous key. It
never copies the service-role key into the app. If `.env` already exists, it
refuses to overwrite it. `.env.example` documents app variables; server-only
keys are in `supabase/functions/.env.example`.

- Supabase Studio: `http://127.0.0.1:54323`
- Local email inbox (Mailpit): `http://127.0.0.1:54324`
- API: `http://127.0.0.1:54321`

No real email is sent in local development. Open the sign-in email in Mailpit
and use its link. For a first signup it is labelled “Confirm your email”; for
returning users it is a magic link. Both sign the user into Slow without a
password. Open the link on the same device running the app. Links expire after
one hour, can be used once, and cannot be re-requested more than once a minute.

### Android emulator

Install Android Studio and an emulator, then Expo Go for SDK 54
([download](https://expo.dev/go?sdkVersion=54&platform=android&device=false)).
With the emulator running:

```sh
adb reverse tcp:54321 tcp:54321
adb reverse tcp:54324 tcp:54324
adb reverse tcp:8081 tcp:8081
npx expo start --localhost --go --android
```

Use `--go` explicitly: this project also includes the development-client package.
In Expo Go, the default callback is
`exp://127.0.0.1:8081/--/auth/callback`, already allowed by local Supabase.
Open Mailpit at `http://127.0.0.1:54324` in the emulator's browser and tap the
email link. If your Expo URL differs, set `EXPO_PUBLIC_AUTH_REDIRECT_URL` to
that exact URL ending in `/--/auth/callback`, add it to
`auth.additional_redirect_urls` in `supabase/config.toml`, then restart
Supabase and Expo. For a native development build, use `slow://auth/callback`.

Push registration is requested only when the push switch is turned on. Expo Go
cannot receive this app's remote push; use an EAS development build with real
FCM/APNs credentials and the Expo project ID. Email works without native push.

### iOS simulator

Requires macOS and Xcode. Use an SDK 54-compatible Expo Go installation or an
Expo development build. Start Expo, choose the iOS simulator, and open the
local Mailpit email in Safari on that simulator. Register the exact Expo Go
callback as described above if it differs. No iOS simulator can run on Linux.

EAS configuration supports development builds for push verification. Signed
store releases, TestFlight, and Google Play distribution remain Phase 3 work.
The `app.slow.checkin` native identifiers are provisional and should be
confirmed before distribution.

### Optional web development

```sh
npm run web -- --port 8081
```

Both `http://localhost:8081/auth/callback` and
`http://127.0.0.1:8081/auth/callback` are allowed locally. The same survey and
database are used, but web does not implement native push permission.

## Phase 1 acceptance walkthrough

1. Request a sign-in link on a simulator and open the captured local email.
2. Q1 and Q2: select one or more answers; choosing “other” reveals a required
   text field. Continue saves each screen's answer to Supabase.
3. Q3: optionally enter something you have been putting off, or skip it.
4. Q4: write what inspires you; optionally pick a season and upload a photo.
   Season is user-selected, avoiding assumptions about hemisphere or photo
   capture date. The server records the upload date.
5. Choose email/push, a day, local 24-hour time, and timezone. Push is off by
   default; email is on. Both can be turned off without blocking setup.
6. Finish setup. Home shows a quiet empty state until the first note is sent.
7. In Studio, inspect `public.users`, `survey_answers`,
   `notification_settings`, and (if used) `photos` plus the private `memories`
   bucket. The row's `user_id` matches the signed-in Auth user.
8. Edit answers or the schedule from Home/Settings. Pause is in notification
   preferences. Restarting the app restores the session and saved answers.

Back buttons do not erase answers already saved by Continue. Survey editing
uses the same save-per-screen behavior as onboarding. A failed save leaves
the answer in place for retry. Photos are JPEGs resized to at most 1600 pixels
on the longest side and capped at 5 MB; metadata is not requested from the
photo picker. Photo resurfacing and account-wide deletion are not built yet.

## Database and security

The migration defines all eight entities from the spec:

`users`, `survey_answers`, `photos`, `messages`, `feedback`,
`notification_settings`, `sky_events`, and `llm_usage`.

Every table has RLS. Authenticated users can read only their profile, answers,
settings, photos, delivered messages, and feedback. Clients cannot write
generated messages, computed sky data, LLM spend, safety holds,
onboarding completion timestamps, or star mode. Completion is a checked RPC
that requires all required answers and notification preferences. Deleting an
Auth user cascades database records; storage-object cleanup and a user-facing
deletion endpoint will be implemented in Phase 3, before any store release.

The private `memories` bucket enforces user-specific paths, JPEG MIME type, and
a 5 MB limit. Photo previews use expiring signed URLs. Service-role credentials
are never used in the app. Auth refresh tokens are stored in the native app's
AsyncStorage, following the Supabase React Native client setup; a production
security review before release should consider encrypted session storage.

Feedback insert/update is restricted to the user's own sent messages. Queue,
delivery, budget, and usage operations are server-only. Phase 2 adds a weekly
pg_cron batch and bounded worker, crisis holds, static prompts, atomic budget
reservations, token/cost logs, push/email adapters, and signed email feedback.
Server credentials and Vault activation are required before live sends.

## Verification

```sh
npm test                     # Pure TypeScript validation and auth-link parsing
npm run typecheck
npm run lint
npm run test:db              # 24 pgTAP schema/ownership checks, transaction rolled back
npm run test:integration     # Real local email magic-link flow and REST/storage checks
npm run test:weekly          # Real local queue/feedback/ledger, provider HTTP test doubles
npm run typecheck:edge       # Deno 2 required
npm run lint:edge
npx supabase db lint --local --level error
npx expo-doctor
npm run build:mobile         # iOS + Android JS/Hermes exports, not signed binaries
npm run build:web
```

Database tests use the **local** project only. The integration script signs up
temporary test accounts, reads their real local email links from Mailpit,
checks saved answers and storage ownership, and removes the accounts. It does
not generate or send check-in messages. Do not run against a real user database.

`npm run db:reset` is a destructive reset of the disposable local database,
not a normal startup step. Only use it when you can discard local test data.

Always use the project's npm scripts (or `npx supabase`), rather than an older
globally installed Supabase CLI. After a CLI upgrade, stop and start the local
stack with the same version so its storage service and database schema match.

## Hosted setup and cost

See [docs/hosted-setup.md](docs/hosted-setup.md). No paid services are
provisioned by this project.

- Local Phase 1: **$0/month** in service charges.
- Hosted Phase 1 within free limits: Supabase **$0/month**, Resend SMTP for Auth
  **$0/month** within its free limits and with an existing verified domain.
- Optional Supabase Pro: starts at **$25/month** for one project; not activated.
- Phase 1 LLM/message generation and delivery: **$0**; they do not run.
- Developer memberships, domain purchases, and signed release-build charges
  are not incurred here and are separate from running costs.

Free Supabase projects may pause after a week without activity, which is
important for a deliberately infrequent-use app. Prefer local development
now; choose hosting before beta. A free tier is not a production uptime promise.

SDK 54 is intentionally a stable, non-canary SDK. Its transitive Expo/React
Native tooling still reports upstream npm audit advisories. Do not blindly
run `npm audit fix --force`: npm proposes incompatible SDK downgrades/React
Native upgrades. Resolve compatible updates and recheck before a beta release.

## Stopping point

Phase 3 and later remain untouched: no store release, public privacy page,
in-app account deletion, sky jobs, star alignment, photo resurfacing, or SMS.
This is not yet a beta-store-ready build. See the Phase 2 guide for activation
requirements and an honest distinction between local doubles and live testing.
