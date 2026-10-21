# Account recovery, identity and maintenance changes

These changes are prepared for review. They have not been deployed and require no schema changes or migrations. The original working folder remains unchanged; this checkout holds the proposed changes.

## Identity

The existing Didit session flow reserves the account's `IdentityCheck` inside a serializable transaction before calling the provider. A unique temporary reference prevents concurrent starts without holding a database connection open during the external request. Final attachment checks the reservation and current account restriction. A failed attempt restores the previous reference only if it still owns the reservation. A process crash leaves a pending attempt that can be retried after the existing 30-minute window.

A correctly signed callback arriving before session attachment receives a retryable server error while registration is pending. Unknown obsolete sessions remain ignored. The existing signature, live-environment, application/workflow, session/user, event-deduplication and chronological checks remain in force. Already verified, unexpired accounts cannot accidentally replace their verification by starting another check.

The real workflow still needs the provider configuration, private secrets and founder-approved processing described in identity-activation.md. DIDIT_ENABLED has not been changed. No documents or selfies have been sent. Do not manually mark real users verified.

## Account email

The existing SMTP_USER, SMTP_FROM and SMTP_PASSWORD settings are reused. No credentials belong in source control. New flag AUTH_EMAIL_ENABLED defaults false; SAFETY_EMAIL_ENABLED remains independent. BETTER_AUTH_URL must be the stable HTTPS app origin. No production variables have been changed.

Once approved and configured, /forgot-password requests a reset link and /reset-password accepts a valid link. Better Auth owns token generation, validation, expiry and password updates. Links expire after one hour; password reset revokes existing sessions using the Prisma adapter's transaction support. Recovery responses do not reveal whether an account exists. Delivery runs through Next.js after-response work so SMTP latency does not determine response timing. No token or provider error is logged by the mail sender.

New signups request verification mail when account email is enabled. Existing users can request verification from Safety & identity. Verification is additive and does not require already-existing users to verify before signing in. Do not enable a mandatory login verification gate without an approved rollout and recovery plan. A verified email does not verify identity.

Email contains plain text and a same-origin purpose-specific link. The reset page and auth routes send no-referrer/no-store headers. SMTP acceptance is not proof of inbox delivery. After-response delivery is not a durable queue: if it fails, the user requests a new link. Only a generic delivery failure is logged.

## Maintenance

Each invocation selects at most 100 unreported overdue attendance rows using bound SQL parameters and the existing unique event-key constraint. Existing overdue cases cannot monopolise future sweeps. Processing has a 20-second soft budget checked between records; in-flight queries/transactions can exceed that budget. Incomplete work produces an unhealthy response and remains eligible for the next invocation. A configured, existing founder recipient is required for a healthy sweep.

Safety processing runs first. Queued emails and media cleanup then run independently so a cleanup failure cannot prevent an email attempt. Failed task execution or email delivery returns 503; responses contain no case information. Disabled email is reported as disabled. The cron secret and existing scheduler are unchanged.

## Validation and activation remaining

Unit tests, lint, TypeScript and an isolated production build can run without a live database or external mail/identity requests. New tests cover concurrent starts, failure restoration, redirect validation, restriction changes, maintenance failures, missing recipients and mail-link validation. The safety integration harness now rejects remote or incorrectly named databases before inserting fixtures.

Before deployment approval, run the existing integration suites against a confirmed local test target. In this environment, local PostgreSQL access was blocked during the audit, so database-backed integration results are not claimed. Provider activation and real reset/verification email delivery need a controlled end-to-end test after private configuration is approved. No live send, migration, push or deployment is part of this change.
