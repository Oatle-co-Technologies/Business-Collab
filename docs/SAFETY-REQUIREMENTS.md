# Safety requirements — agreed direction and implementation decisions

Safety work takes priority over hosting and PWA rollout. This document records the founder's requirements; it does not claim the controls are implemented.

## Confirmed requirements

- Verify the person behind each business. Business registration documents are not required; informal businesses are welcome.
- Verification must support accountability if an incident occurs. It is not proof that someone is safe or that a business's work is authentic.
- Every scheduled collaboration activity needs an agreed date, check-in and check-out, including activities that are not home visits.
- Dates must be changeable.
- Provide incident reporting and an operational response process.
- Keep messaging tied to collaboration invitations and selected teams.

## Proposed identity workflow

Allow account creation and private draft preparation; require successful identity verification before publishing, organising, applying, accepting invitations or being selected. Recheck eligibility on the server for these actions and messages. Existing accounts start unverified; do not infer verification from email, video, reviews or existing publication. Apply enforcement only when a real provider is integrated and the transition for existing prototype accounts is ready.

Use a specialist hosted verification flow for document authentication, liveness and face matching. Select the provider and supported identity documents with the founder before implementation. Do not restrict eligibility to South African citizens solely because the app operates in South Africa.

Store the provider reference, decision, timestamps and minimal audit information needed for the agreed process. Avoid storing raw identity documents, ID numbers or biometric captures in the app. Never expose these to other members. Authenticate provider callbacks and verify decisions server-side; browser redirects must never grant verification. Failed, pending, expired, suspended and disputed decisions must not count as verified. Plan a retry/manual-review route and account recovery protections. Verify the actual person attending, not just an owner who sends someone else.

Use a precise badge such as “Identity checked”; never “Safe” or a guarantee. Decide data retention, provider processing locations, access controls and lawful incident disclosure before collecting real identity data. Records support an appropriate investigation; they are not a promise of identification or recovery in every incident.

## Proposed activity and attendance workflow

A collaboration can have multiple scheduled activities. Each activity records a start/end time in Africa/Johannesburg, the agreed venue or remote arrangement, and the people expected to attend. Keep residential addresses out of public briefs and notifications.

Each attendee confirms the plan and records their own check-in and check-out. Do not let organisers mark another person safe. Manual check-in is an acknowledgement, not location verification or proof of safety. No continuous location tracking by default.

A date/time/location change creates a new schedule version, preserves the old version in the audit history, notifies attendees and requires their acknowledgement again. Historical attendance remains attached to the original schedule version. Do not silently move an activity already in progress: finish/cancel that record explicitly and create a replacement. Changes must never erase overdue attendance or an incident.

Attendees can decline or cancel for safety reasons without an automatic negative rating. Record expected end time and configurable grace period. An uncompleted check-out becomes “Check-out overdue”, not “Emergency confirmed”. Never auto-check someone out or label them safe because time passed. A worker may forget to check out; an attacker may coerce a check-out.

## Escalation decisions required before implementation

Choose who receives overdue and urgent alerts, their availability and the response steps. A saved database report or on-screen notification is not a monitored response service. Background scheduling, reliable delivery, retry handling and acknowledgement are required before promising missed-check-out alerts. Do not imply police, emergency services or trusted contacts have been alerted without confirmed delivery through an explicitly authorised channel.

Decide whether trusted contacts are part of the first release and how they consent to notifications. Do not send incident details or precise addresses to contacts or third parties without an appropriate authorised process.

## Reporting and response

Support reports about a business, collaboration or scheduled activity, with a private audit trail and optional evidence. Limit sensitive report access to authorised reviewers. Do not publish accusations on profiles. Define triage, acknowledgement, investigation, suspension/restriction, appeals and evidence retention. Urgent reports must explain the actual monitoring hours and limits. Separate emergency assistance from routine moderation. No automatic suspension based solely on an unreviewed accusation.

## Implementation update

Implemented: private versioned activity scheduling in SAST; plan acknowledgements; personal check-in/out and append-only attendance events; cancellation and completion safeguards; private activity/business/chat reports; a founder-first inbox with acknowledged assignment to configured team account IDs; audited case follow-up and account restrictions; an idempotent durable overdue-case worker; server-side identity gating; and a disabled hosted Didit integration with live-only signed callbacks and event replay tracking.

The founder account is pinned by user ID in local configuration to the existing demo account explicitly identified by the founder. No team accounts are configured yet. Existing users have not been marked verified. Identity enforcement is active even while the provider is disabled: draft preparation, reporting and check-out remain available.

No external email/SMS/push delivery is configured. Worker and web server must be running; a hosted persistent scheduler and delivery service are still required before promising unattended alerts. Formal privacy/retention policies, live provider credentials/workflow acceptance tests, staff onboarding and response hours remain launch requirements. Trusted-contact notifications, evidence uploads, staff/substitute identity enrolment and appeals UI are not implemented. Only the checked account holder may attend.

## Original gaps (before this implementation)

At the start of this work the app had no identity provider, verified status, activity schedule, attendance log, overdue alert delivery or moderation console. Chat reports were stored records only. Do not advertise these proposed protections as available or launch with a safety guarantee.

## Acceptance checks

- Forged client-side verification or callbacks cannot unlock a profile or collaboration action.
- Owners cannot mark another person verified, checked in or checked out.
- Unrelated members cannot read addresses, attendance, identity references or reports.
- Rescheduling preserves history and invalidates previous acknowledgements without erasing check-ins/incidents.
- Overdue jobs are idempotent, survive restarts and have delivery failure handling.
- Every suspension and sensitive record access is auditable; only authorised roles can perform them.
- Reports have an actual assigned recipient and acknowledgement/escalation process before release.
