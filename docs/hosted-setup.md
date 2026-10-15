# Hosted Supabase setup (optional)

Local development is fully supported without paid accounts. These are manual
instructions for pointing Slow at a Supabase project you own; they are not
executed automatically. For weekly delivery, server secrets, Vault activation,
push credentials, and the public feedback page, also follow [Phase 2](phase-two.md).

1. Create a Supabase project (Free is sufficient for development).
2. Use the pinned Supabase CLI to link the intended project and run
   `npx supabase db push` after inspecting its migration history. Apply all
   migrations in order, not only the original Phase 1 SQL. Weekly outbound work
   remains inert until its Vault secrets and Edge Functions are configured.
3. In Auth settings, keep email enabled and anonymous, phone, and social login
   disabled. Enable email confirmation. The app uses only magic links;
   no password screens or social providers are implemented.
4. Set the Site URL to `slow://auth/callback`. Add that exact callback and any
   exact Expo Go development callback to Auth's allowed redirect URLs. Avoid
   unrestricted wildcards. Add the exact hosted web callback if web sign-in is
   desired; the login-free email feedback page does not require an auth callback.
5. For email to ordinary addresses, configure **Resend SMTP** in Supabase Auth.
   Supabase's default SMTP is restricted to project team addresses and about
   two emails per hour, so it is unsuitable for friends signing up.
6. Resend requires a verified sending domain. Follow its instructions for
   the domain's DNS records, then configure Supabase's custom SMTP:
   host `smtp.resend.com`, port `465`, username `resend`, password a Resend API
   key, sender a verified address, sender name `Slow`. Disable email link
   tracking so authentication links are not rewritten.
7. Put only the hosted API URL and **publishable/anon** key in local `.env`.
   Never use a Supabase `service_role`/secret key or a Resend key in an
   `EXPO_PUBLIC_` variable. Server credentials belong in the service settings.
8. Restart Expo. Sign up and inspect the same tables in hosted Studio.

No secrets are needed from Bee for the local acceptance flow. Hosted setup
requires Bee's choice of Supabase project, a Resend account, and a verified
sending domain. EAS account/project setup and Apple/Google membership are not
necessary for the local Phase 1 flow. Phase 2 push verification requires an Expo
project and configured development build. Store distribution remains Phase 3.

## Documentation

- [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase native deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase SMTP limits/setup](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend SMTP](https://resend.com/docs/send-with-smtp)
- [Supabase pricing](https://supabase.com/pricing)
- [Resend pricing](https://resend.com/pricing)
- [Expo notification limitations](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)
