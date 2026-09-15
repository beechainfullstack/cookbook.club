# cookbook.club

An Expo iOS/Android MVP for positive recognition within a verified high school. The only social action is tagging a synced contact with a fixed positive flavor. The school Book is permanent, chronological, and visible to verified classmates, including classmates outside the viewer's contacts.

`copy.json` includes the supplied product wording under its original keys. Supporting controls, error messages, and accessibility copy remain centralized in the same dictionary for review.

## Run a preview

Requires Node 24 (exact tested version in `.nvmrc`) and npm.

```sh
nvm install
nvm use
npm install
EXPO_PUBLIC_DEMO_MODE=true npm run web -- --port 8081
```

Demo mode uses fictional sample people and in-memory entries. It is available only in development; EAS profiles disable it. Restarting the demo resets its data. Web supports layout previews and authenticated Book browsing; device contacts and Expo push require iOS/Android.

## Run with Supabase

Docker must be running.

```sh
npm run db:start
cp .env.example .env
npx supabase status
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` using the local API URL and anon key. Keep `EXPO_PUBLIC_DEMO_MODE=false`. Restart Metro after changing environment variables.

The API runs on `61321`, Postgres on `61322`. For a physical phone, use your development computer's LAN IP in the API URL; Android emulators use `10.0.2.2`. The development phone must be able to reach the computer.

On a fresh local database, the seed creates **Local Test High School** with code **local-school-code**. Local phone numbers `+14155550101` through `+14155550104` use OTP **123456**. These reserved test numbers bypass a dummy SMS provider; no SMS is sent. Keep these fixtures confined to local development. Hosted projects need their own SMS provider and school codes.

```sh
npm start
# With Android SDK installed:
npm run android
# With macOS and Xcode installed:
npm run ios
```

`npx supabase db reset --local` recreates the local database and loads the seed. It erases local test data. On an existing database, apply outstanding migrations with `npx supabase migration up --local` instead.

There is no pre-commit or Husky configuration. CI runs lint, type checks, unit tests, database tests, the push-worker type check, and web/iOS/Android JS exports.

## Model and boundaries

- Auth uses verified phone numbers. Enrollment checks age 13+ again on the server.
- School selection plus a school-issued access code creates an immutable school membership. The operator provisions codes; arbitrary school names do not grant Book access.
- Contacts sync normalizes phone numbers to E.164, matches confirmed users in the same school, and replaces the caller's taggable graph. Names from the address book and unmatched phone numbers are not persisted.
- `create_tag` enforces the school/contact boundary, excludes self-tags, accepts only the flavor enum, and uses request UUIDs for idempotent retries. A sender may tag a recipient once per minute without needing to receive a tag first.
- **Reveal window: all time.** The first three distinct taggers form the recipient's permanent reveal group. On the third distinct tagger, every existing entry for that recipient reveals those three identities. Later entries inherit that group; a fourth tagger does not replace it.
- Recipient-row locking serializes simultaneous tags. Raw taggers remain in `private.tags`; unrevealed API rows expose neither their names nor their IDs.
- RLS scopes profiles and Book entries to the viewer's school. The Book uses newest-first cursor pagination and Realtime subscriptions.
- A transactional outbox records one reveal notification per recipient. A scheduled Edge Function dispatches Expo push messages with leases and retries.

Server authorization establishes the synced contact graph; the OS permission prompt itself runs on the device. Like other contact-matching systems, the server cannot independently prove a submitted number came from an unmodified device address book.

## Copy

All app text, flavor labels, accessibility labels, permission prompts, and push content are read from `copy.json`. Templates support the supplied `{tagged_name}`, `{tagger_1}`, `{tagger_2}`, `{tagger_3}`, `{school_name}`, and `{flavor}` variables, plus supporting `{user_name}` and `{count}` variables. Names are inserted once as plain text.

`src/lib/copy.ts` maps the existing database identifiers to the supplied six flavor labels: `art` → `flavor_1`, `sports` → `flavor_2`, `ideas` → `flavor_3`, `style` → `flavor_4`, `kindness` → `flavor_5`, and `music` → `flavor_6`. These identifiers are internal; the picker and Book use the supplied labels and order. “Something else” is a fixed positive tag, with no free-text input.

The welcome screen and compiled native permission prompt use the dictionary's “your school” fallback before school selection; the in-app contacts explanation uses the verified school name. Reveal notification flavor comes from the entry that completed the three-person threshold and is saved with the notification event.

`revealed_text_single` and `new_tag_*` are preserved as supplied but are not used by the current three-person reveal rule: names stay hidden until three distinct taggers, and only the reveal queues a push.

`notifications.sms` uses Supabase's `{{ .Code }}` placeholder. `npm run copy:sync` generates the local SMS template from it; `npm run db:start` runs this automatically. Set the hosted SMS template to this same dictionary value in Supabase Auth.

Changing the dictionary requires an app rebuild/update. Changing native permission copy requires a native rebuild; push copy requires redeploying the worker. This MVP does not include remote experiment assignment or a copy-management dashboard.

## Checks

The SQL tests use fixed local fixtures and expect a fresh test database. Run them before enrolling local app accounts, or reset a disposable local database first.

```sh
npm run lint
npm run typecheck
npm test
npm run check:worker
npm run db:start
npx supabase db reset --local
npm run test:db
npx supabase db lint --local --level error
npm run build:web
npm run build:mobile
```

Mobile exports validate the platform JS bundles; they do not compile a signed iOS/Android binary or exercise device permissions. Validate contacts, real SMS delivery, and push arrival on physical devices before release.

Regenerate public database types after schema changes:

```sh
npx supabase gen types typescript --local > src/lib/database.types.ts
```

See [deployment instructions](docs/deployment.md) for school provisioning, hosted auth, push scheduling, and EAS builds.
