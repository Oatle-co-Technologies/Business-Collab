# Hosted pilot and phone installation

## Approved services and current resources

The founder approved Prisma Postgres's free pilot in Frankfurt, private Vercel Blob media in Cape Town, and Vercel hosting. Database records therefore leave South Africa. No paid upgrade is authorised.

The existing repository is linked to the empty Vercel project `business-collab` under `vinoliamoekwas-projects`. A private Cape Town Blob store, `business-collab-media` (`store_2353A6YwsigTc3hP`), is connected to preview and production. No app deployment or existing-data transfer has been performed. Prisma marketplace terms were accepted, and the free Frankfurt resource `business-collab-db` (`store_BW1NWnBvuWakSSkd`) is now connected to preview and production. The new database was verified empty and all 18 application migrations were applied successfully; no local accounts or business records were transferred. Do not create duplicate resources when resuming.

## Configuration before deployment

Keep local development on the local PostgreSQL database. Never replace `.env` with cloud credentials or commit `.env.local`. Configure production and preview variables through Vercel, with separate databases/data boundaries where appropriate:

- `DATABASE_URL`: hosted PostgreSQL pooled TCP connection; `DIRECT_URL`: direct connection for migrations.
- `BETTER_AUTH_URL`: the exact stable HTTPS app origin. Use an independent secret of at least 32 random characters in `BETTER_AUTH_SECRET`.
- `MEDIA_STORAGE=vercel-blob`; private `BLOB_READ_WRITE_TOKEN`, or `BLOB_STORE_ID` with Vercel OIDC. Never expose storage credentials through `NEXT_PUBLIC_` variables.
- `SAFETY_FOUNDER_USER_ID`: an existing, authorised account ID in the target database. The local demo account ID does not automatically exist in an empty hosted database. Keep team access empty until explicitly authorised.
- `CRON_SECRET`: at least 32 random characters, used as the Bearer token for `/api/cron/maintenance`.
- Keep `DIDIT_ENABLED=false` until the live identity provider is configured and approved. This deliberately blocks publication and participation by unverified users.

Run `npm run hosting:check` with the target environment, review migrations, then run `npm run db:deploy` against that target. The Vercel build uses `hosting:build` and fails if required hosting settings are absent. Migrations are a separate controlled step, not an automatic build side effect. An existing-data transfer needs a deliberate backup, transfer plan and founder approval; never silently upload the local database.

Configure a persistent authenticated scheduler to call the maintenance endpoint at least every five minutes, with monitoring/retries. No hosted schedule is configured automatically. The endpoint runs overdue-attendance detection and expired-upload cleanup. Missing scheduling means missed-checkout cases are not generated in the background. Alerts remain in-app; there is no external delivery or emergency response integration.

## Private media flow

Owners receive short-lived upload permission for one allocated slot. Files upload directly into private quarantine storage, avoiding server request limits. The server checks ownership, file size, actual image/video content and slot constraints, converts images to metadata-free WebP, and writes an immutable validated object. Only a validated, unexpired, unused ticket belonging to that owner and business can be attached during the profile transaction. Reusing a ticket or submitting another owner's ticket is rejected.

Private media reads still require the app's session and profile access checks. Blob paths are not public URLs. Videos support byte ranges. Expired temporary uploads are cleaned by maintenance; attached media is retained. The local database-media mode remains available for development.

Before a phone pilot, test real private upload → validation → profile save → authorised playback and denial to another account, using synthetic content. Local unit checks do not establish that live provider credentials or deployed media processing work.

## PWA behaviour

The manifest and temporary neutral BC icons support installation from a hosted HTTPS origin. Production registers the service worker; development does not. Only generic offline help and icons are cached. Private profiles, chats, API responses and identity/safety records are never deliberately stored in the service-worker cache. Offline submissions are blocked; no message, report or attendance event is queued or claimed saved. Updates require an explicit reload action.

On iPhone use Safari's Share → Add to Home Screen. On Android use the browser's install action or the app's install control. A phone cannot reach the computer's `127.0.0.1` address. Installation and physical-phone testing remain pending a hosted HTTPS pilot. Push notifications, working offline, live Didit verification and external safety escalation are separate unfinished capabilities.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Use the existing isolated/local integration suites for account, collaboration, chat, review and safety regressions. Do not point local test fixtures at a production database. Production dependency audits should be repeated before release.

Latest local verification (17 October 2026): all 36 unit tests, ESLint, production build, isolated safety integration and the account/profile HTTP integration suite passed. Synthetic accounts and fixtures were removed. Live hosted upload/playback, database connectivity, hosted scheduling and physical-phone installation remain unverified pending provider setup and an HTTPS deployment.

Hosted database connectivity and schema initialization were verified on 17 October 2026. Local `.env` and `.env.local` database settings were not replaced. Deployment, hosted founder-account setup, maintenance scheduling and live media round-trip checks remain pending.

## First production deployment

The founder authorised deployment on 17 October 2026. The live origin is https://business-collab.vercel.app and authentication is configured for that exact origin. The current deployment is `dpl_6jkbkm3S88m5WhmbKXoWPGpySBW7`. Explicit `.vercelignore` rules exclude local environment files and development artifacts; the superseded initial deployment was removed.

Live verification passed for sign-up/sign-in pages, manifest, service worker no-store headers, offline help, icons, unauthorised maintenance denial and streamed anonymous private-page redirection. A temporary synthetic account verified hosted signup, secure session cookies, database-backed sessions and the owned-business page; it was removed afterward. The hosted founder account must still be created and its actual ID securely pinned. The configured local founder ID grants nobody access in this empty hosted database. Didit remains disabled, and persistent scheduling/external safety delivery and live media round-trip/physical-phone QA remain pending. No existing local user/business data was transferred.

The founder subsequently created `founder@oatle-technologies.co.za` in the hosted app. Its unique existing account was looked up directly in the hosted database, and production `SAFETY_FOUNDER_USER_ID` was pinned to that exact ID. Deployment `dpl_ATFQYHRSDF32AANCE8M5cM9qEzqL` applied the change successfully. No access is assigned through an email submitted by an app user. Email delivery, live identity verification and background scheduling remain pending.

Founder email queue preparation was deployed as `dpl_EQQrQEbnXUcXEWLGFvZwJtjomCPR`. The hosted queue migration succeeded. Forty unit tests, lint, build and isolated safety integration passed; production dependency audit reported zero advisories. Production SMTP_USER/FROM are set to the founder mailbox, with SAFETY_EMAIL_ENABLED=false and no SMTP password configured. Scheduler preparation is approved but requires the founder-controlled cron-job.org account; neither email delivery nor automatic scheduled checks are active yet. See safety-alerts.md for activation.
