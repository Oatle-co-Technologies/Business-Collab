# Business Collab

A South African business-to-business collaboration app for small businesses working together on client projects. Built with Next.js, React, TypeScript, Tailwind CSS, Prisma ORM 7, PostgreSQL and self-hosted Better Auth. Styling is intentionally neutral and responsive.

## Accounts and ownership

Email/password sign-up, sign-in and sign-out are implemented. Passwords require 12–128 characters and are hashed by Better Auth. Sessions are stored in PostgreSQL, use HttpOnly cookies, expire after seven days and are revoked server-side on sign-out. Cookie session caching is disabled so revocation and ownership checks use current server data. Auth endpoints use Better Auth's origin/CSRF protections and enabled rate limiting (persistent database storage in production; per-process memory in development).

New business profiles belong to the signed-in user; ownership never comes from submitted form fields. The server checks ownership before processing edits and again inside the write transaction. My businesses and draft lists show only that user's records. Another member can read published owned profiles but cannot edit them. Draft profiles, logos and media are private to their owner; anonymous media requests are denied. Edit links are hidden from other members, with server checks independently enforcing the same rule.

Existing prototype profiles and media are retained with a null owner. They are not automatically assigned to the first registrant or an account with a matching email. They remain hidden and cannot be claimed through the UI. Linking one requires explicit founder-authorised migration after the intended account exists. An account can currently manage multiple profiles, preserving the existing Add business flow.

Email verification and password recovery are implemented using the existing Purelymail SMTP settings. Delivery requires `AUTH_EMAIL_ENABLED=true` and a verified HTTPS app origin; the flag defaults off. See [account recovery and identity rollout](docs/account-recovery-and-identity.md). Existing accounts retain sign-in access; email verification does not grant identity verification. Social sign-in, account deletion, ownership transfer and multiple managers are not implemented. Identity verification is prepared but disabled, as detailed below. An account does not imply a verified identity. Before launch, connect email delivery and verify the production rate-limit configuration.

## Business profiles and discovery

Create, view and edit business profiles with a description, town, discovery area, optional industry, service categories, contact details and website/portfolio links. Save drafts while preparing content. Publishing requires a profile picture/logo, one introduction video, one work showcase video, and 2–5 work pictures. This is a completeness check, not an authenticity or identity badge.

Home requires sign-in and an explicit discovery-area selection, then shows paused introduction/work clips from published owned businesses in that area, newest uploads/replacements first. Towns stay visible. Starting one video pauses the others. Pages contain up to 12 clips. There are no likes, follows, comments or reactions. The only app action on a video card opens the business profile. Refreshing the feed picks up new uploads; there is no live push subscription yet.

The suggested pilot discovery area is “Pretoria, Centurion & Johannesburg”; owners can enter another shared name. Matching ignores case and normalises whitespace. This is explicit grouping, not GPS, automatic town inference, distance calculation or areas-served coverage. An empty area does not silently fall back to another. Existing profiles retain a blank discovery area until edited.

Search switches to business cards without videos, combining keyword, town and service filters with the selected area. Searching without an area is explicitly across areas. Draft lists are private to the signed-in owner. Work pictures support optional captions up to 500 characters, including edits to existing photos. Video prompts encourage owners to introduce themselves and explain their own contribution.

Video overlays show name, town, area, industry (or services) and an honest “0 reviews.” Database-backed ratings and counts include reviews from eligible participants in completed collaborations.

## Local setup

Use Node.js 22.12+ (or another Node version supported by Prisma 7), PostgreSQL, and FFmpeg's `ffprobe`. On the original Mac, PostgreSQL 17 and FFmpeg are installed, PostgreSQL is running, and the database and private environment configuration already exist.

For a new checkout:

```bash
brew services start postgresql@17
createdb business_collab
cp .env.example .env
```

Set `DATABASE_URL` for your PostgreSQL user, `BETTER_AUTH_URL` to the app origin, and replace the `BETTER_AUTH_SECRET` placeholder with a unique random secret of at least 32 characters. For example, generate a secret with `openssl rand -base64 48`. Keep `.env` private and never put database/auth secrets in `NEXT_PUBLIC_` variables. The original Mac's secret was generated locally and is not tracked.

For local development, both http://127.0.0.1:3000 and http://localhost:3000 are trusted origins. Cookies are host-specific: use the same hostname consistently when signing in and testing. Production only trusts the configured app origin and requires HTTPS for secure cookies. Changing host/port requires updating the auth URL/trusted-origin configuration deliberately.

A packaged `ffprobe` binary is included; `FFPROBE_PATH` can override its absolute executable path.

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://127.0.0.1:3000/sign-up to create your account. If changing the Prisma schema during development, regenerate the client and restart the development server to refresh its cached client.

## Checks

```bash
npm run lint
npm test
npm run build
npm run db:studio
```

With the development server running on the original local database, also run:

```bash
npm run test:accounts
```

This local-only integration test creates two temporary accounts with random credentials, submits actual Next.js server actions (including a forged owner/edit request), tests draft/media isolation and session invalidation, and removes its own accounts/profiles/media afterward. It uses the local `psql` connection to the `business_collab` database. It must not be pointed at production. Authentication rate limiting applies, so wait a minute between repeated account-test runs if you reach the sign-up limit. The harness reads Next.js's generated server-action manifest and uses the installed React Flight encoder, so it may need adjustment after a framework upgrade.

Unit tests cover access rules, safe login return paths, discovery filters, required media, upload validation, photo captions and video ranges. Browser tests cover profile saves, media playback, publication limits, feed/search behaviour and account screens. Review generated migrations before applying them to shared databases; future hosted releases need a controlled `prisma migrate deploy` step.

## Media and hosting limits

Images are still JPG/PNG/WebP, up to 2 MB each, decoded and converted to WebP with metadata removed. Maximum dimensions: logo 512×512, work pictures 1200×1200, aspect ratio preserved. Videos are MP4/H.264 or WebM/VP8/VP9, up to 10 MB and two minutes each, validated by `ffprobe`. Video responses support byte ranges.

New videos replace their slots. Photos may be added or marked for removal. Profile updates, publication checks and media changes are atomic. Saving without a replacement retains existing media. Validation retains text values; file inputs must be selected again if a submission fails, as the form explains.

Local development keeps media in PostgreSQL and accepts form requests up to 34 MB. Hosted mode uses private Vercel Blob direct uploads, server validation and metadata-only profile submissions limited to 1 MB. See [hosted setup](docs/hosting.md). No deployment or existing-data migration has been performed.

## Remaining work

Accounts, collaboration requests, invitations, in-app chat/alerts, completion and participant reviews are implemented as described below. No WhatsApp or payments integration. Client-relationship rules and referral/payment models remain founder decisions.

PWA manifest, temporary neutral icons, install help, update controls and a private-data-safe offline fallback are implemented. Phone/background push notifications remain unimplemented. Capacitor comes later and needs a decision about mobile access to the backend.

## Structure

- `src/app/`: account pages, business pages, server actions and auth/media route handlers.
- `src/components/`: auth/profile forms, account navigation, media and video feed.
- `src/lib/`: auth/session helpers, access rules, database client and validation.
- `prisma/`: schema and committed migrations.
- `tests/`: unit and dedicated local account integration tests.
- `src/generated/prisma/`: generated, ignored client.

The existing Next.js ESLint chain reports five development-only advisories from `braces`; the suggested automated fix downgrades tooling across major versions and has not been applied. Production dependencies were clear at setup; recheck before deployment.

Latest account verification: lint, all 18 unit tests, the production build and the reusable two-account HTTP integration test passed. Browser registration, sign-out and sign-in passed. All temporary test accounts, sessions, businesses and media were removed. The production-dependency audit reported zero advisories; the existing development-only lint-tool advisories remain as described above.

## Collaboration requests and invitations

Signed-in owners with a published business can create project requests with a title, brief, required service categories, town and discovery area. Choose Open to applications or Invitation only. Accounts may organise requests for any of their own published businesses; an owner cannot organise for another account or invite/apply with one of their own businesses to their own request.

The Collaborations hub shows the member's invitations, organised requests and responses/selections, plus other members' open opportunities. Invitation-only requests are visible only to the organiser and owners of businesses with an invitation/response. Published business profiles have an Invite to collaborate link: choose an existing eligible request or create a new one, then explicitly send the invitation.

Invitations start Pending. Accepting records Interested, not Selected; only the organiser can select or decline an interested applicant. Open requests allow owners to apply using a published business. A business has at most one invitation/application entry per request, enforced by a database unique key. Duplicate invitations/applications and self-invitations are rejected. Declined, rejected or withdrawn entries cannot currently be resubmitted; that policy can be revisited later.

Owners can decline pending invitations and withdraw interest or selection. Organisers can undo a selection, close a request to new responses/selections, or reopen it. Closing does not mark a project complete and does not delete the team. Declining/withdrawing remains possible while closed. Selected team names are visible to authorised request viewers, but invitation/application messages are restricted to the organiser and the business they concern. Other applicants do not receive each other's private messages.

Writes check the current authenticated owner on the server and use serializable transactions for creation/invitation/application/response/selection. Direct or forged server-action calls cannot act for another owner. Existing profiles and accounts are preserved.

Invitations are visible in the Collaborations inbox and generate in-app notifications. Chat, project completion and review eligibility are described below. Push alerts remain unimplemented. No agreements, pricing, client-relationship rules or payments are implied by selecting a collaborator.

For the local development server/database, run `npm run test:collaborations`. It creates three temporary accounts and business fixtures, exercises actual server actions and privacy/ownership rules, then removes its own requests, profiles, accounts and sessions. It is restricted to loopback app URLs and uses the local `business_collab` database. Do not run account integration suites repeatedly within the same minute; the normal sign-up rate limit applies. The collaboration fixtures set publication directly to isolate these tests from the separate profile/media tests.

Browser QA exercised request creation, invitation delivery to the intended account, acceptance, organiser review and selection. The temporary browser-test profiles used complete media fixtures; they and their accounts/requests are removed after testing. Unit checks cover service validation, consent-before-selection, role-restricted transitions and closed-request rules.

Collaboration verification: lint, all 21 unit tests, and the production build passed. The three-account integration checks and browser create → invite → accept → select flow passed. Temporary verification accounts, businesses, and requests were removed.

## In-app conversations and notifications

Private text chats are scoped to an invitation for a specific collaboration. They open only when the invited business confirms interest (INTERESTED or SELECTED); pending invitations and unsolicited applications do not unlock private chat. Only the organiser and that invited business owner can read or send. Each invitation has its own conversation. Declining, withdrawal or rejection revokes access. General business profiles have no messaging button, and previous unscoped chats are inaccessible. Ownership, invitation status and published sender status are checked on every send. Messages are limited to 4,000 characters and 20 per owner per minute. No external messaging provider is used.

Project chats are available from collaboration details to the organiser and currently selected collaborators, including when responses are closed. New selected collaborators can read the project history; withdrawn or deselected collaborators lose access immediately. Private account blocks prevent new private chats/messages across all businesses of either owner; they do not remove shared project access. Chat reports go into the private founder-first safety inbox. Reports are not an emergency service; external alerts and response hours are not configured.

Messages and collaboration invitations, applications, responses and selection changes create in-app notifications transactionally. Navigation badges and open pages refresh every 10 seconds while visible. Read markers are explicit; notifications can be marked read independently of conversation unread status. Conversation pages show 50 messages with older-message navigation; the inbox and notifications show the latest 100 entries. Phone/background push, attachments and external delivery are not included.

Run `npm run test:chat` against the local development server for multi-account access, spoofing, blocking, reporting, unread alerts and project membership checks. Like the collaboration tests, this creates and removes isolated fixtures; allow the signup rate-limit window to reset between suites.

## Completion and reviews

An organiser can confirm a collaboration complete after selecting at least one collaborator. Completion is separate from closing applications. It is final: no reopening, selection changes, applications, invitations or withdrawals afterward. Existing project conversations remain accessible to the final team.

After completion, the organiser and selected collaborators can rate another final-team business from 1–5 and write a 10–2,000 character review. Reviews are limited to one per author/target business pair per collaboration; authors cannot review themselves, another business they own, or unselected applicants. Reviews are published immediately and cannot be edited in this version. Business profiles show the average and latest 20 reviews; video cards show the average and count, including 0 reviews when none exist. Private collaboration titles and briefs are not exposed with public profile reviews. Completion and new reviews create in-app notifications.

Run `npm run test:reviews` against the local development server to check completion permissions, final-team locking, review eligibility, duplicates, invalid ratings, reciprocal reviews, notifications and displayed profile/feed ratings. This suite creates and removes temporary accounts and records. Unit tests include review validation and ownership rules. Browser verification covered complete → review → published profile.

## Safety, identity and attendance

Identity checks are mandatory for publishing and collaboration participation. Existing users are unverified; profile media and reviews never grant identity status. The Didit integration is prepared but disabled locally (`DIDIT_ENABLED=false`), so drafts, safety reports and check-out remain available while publishing, organising, applying, accepting invitations, messaging and check-in are restricted. Verified, unexpired identities and unrestricted accounts are required server-side. Unverified businesses are omitted from discovery. No real identity documents or biometrics are stored by this app.

Before enabling Didit, configure a live hosted workflow with document verification, liveness and face matching; the API key, application ID, workflow ID and destination signing secret; and a public HTTPS callback at `/api/identity/didit`. Approve provider privacy/processing/retention arrangements and test the real workflow before activation. The hosted flow starts only with user consent. Browser return parameters cannot approve an identity. V2 signatures, signed-body freshness, application/workflow/session/user correlation, required successful checks, live environment, event deduplication and stale-event rejection protect the callback. Incomplete/sandbox results cannot grant verification. References: https://docs.didit.me/integration/api-full-flow and https://docs.didit.me/integration/webhooks . Do not use test credentials with real users.

From a collaboration, organisers schedule private activities for themselves and selected collaborators. Times are interpreted explicitly as SAST. Each new plan version requires personal acknowledgement. Previous plans and attendance events are preserved. Rescheduling or cancellation cannot erase check-ins. Organisers cannot record another person's attendance, and a collaboration cannot complete with unresolved activity attendance. A declined activity does not generate a rating penalty. Checked account holders attend as themselves; substitute/staff attendance is not supported.

`SAFETY_FOUNDER_USER_ID` pins founder access to one existing account; never grant it by a browser-submitted email. `SAFETY_TEAM_USER_IDS` is a server-only allowlist of existing account IDs. The founder receives each case first and must acknowledge it before assigning follow-up. Team members see only assigned cases, cannot grant access or restrict accounts, and cannot read founder-only notes through their own unrelated reports. Sensitive case reads and follow-up are audited. Restriction/restoration is founder-only and limited to involved business owners. Do not manually mark users verified to test real participation.

Run `npm run safety:worker` alongside the web server locally. It checks persisted attendance every 30 seconds and creates a case 30 minutes after the expected finish if a checked-in attendee has not checked out. `npm run safety:sweep` runs once. Unique event keys make repeated sweeps idempotent; failures retry on the next sweep. Alerts go to the founder's in-app notifications, without addresses or report contents. If the founder is unconfigured, cases remain queued. A late check-out records follow-up but does not resolve a case. Configure hosted durable scheduling and external delivery before promising background alerts: this local worker stops when the machine/app process stops and cannot contact emergency services.

`npm run test:safety` starts an isolated production server on loopback port 3107 using synthetic users, founder/team IDs and fake signing keys. It never contacts Didit. It covers identity gating, scheduling/attendance ownership, version changes, private reports, founder-first assignment, restrictions, durable overdue cases and signed callback security; fixtures and the test server are removed afterward. Run the production build first.

Safety verification results: 28 unit tests, the isolated safety integration suite, existing invitation-chat integration tests, lint and production build passed. Browser verification covered disabled identity status and schedule → confirm → check-in → check-out. All synthetic fixtures were removed; no real account was marked verified. Local founder routing is bound to the explicitly authorised `demo@oatle-technologies.co.za` account ID, not the initially suggested address.

## Founder email alerts

A durable founder-only safety email queue is prepared, with retry leases, bounded backoff and generic notices that link to the private inbox. Purelymail delivery remains disabled pending private SMTP credentials and a live test. Automatic five-minute checks still require an approved scheduler; the current Vercel Hobby plan allows only daily cron. See [activation settings and delivery limits](docs/safety-alerts.md). Unit checks now cover founder-only routing, retries and concurrent-worker exclusion; existing safety integration checks pass.
