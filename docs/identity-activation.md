# Didit activation handoff

Status on 17 October 2026: integration prepared; production DIDIT_ENABLED remains false. No live verification session was created and no identity documents or biometric captures were transmitted. Signing into a Didit account and approving its provider configuration are still required.

## Provider setup

Use a founder-controlled Business Console account at https://business.didit.me/ . Keep credentials in Vercel Production Secrets, never chat. No paid balance, automatic top-up or paid modules are authorised. The current published free allowance is 500 full KYC bundles monthly; Didit flags pricing changes on 1 November 2026, so recheck before activation.

Create the Business Collab application/workflow with ID verification, passive liveness and face match. Confirm supported South African documents in the actual workflow. Business-registration paperwork is not required by this app. Verify the workflow cannot approve when any required check fails or is skipped.

Configure a webhook destination for status.updated and data.updated at:
https://business-collab.vercel.app/api/identity/didit

Use the destination's signing secret, the application ID, workflow ID and API key as:
- DIDIT_WEBHOOK_SECRET
- DIDIT_APPLICATION_ID
- DIDIT_WORKFLOW_ID
- DIDIT_API_KEY

Keep DIDIT_ENABLED=false until the provider workflow, privacy settings and test results have been reviewed. A configured callback URL is not proof that real verification succeeds.

## Privacy choices to approve

Review Didit's verification privacy notice, biometric retention policy and business terms. Its public documentation describes EU processing by default. Choose a finite operational retention period, whether any separate biometric-template retention is needed, and model-training/data-use settings. These choices have not been made on the founder's behalf. Confirm the app's own user notice and request/deletion process before inviting real users. Business Collab stores provider references, status and dates, not raw documents or selfies; provider storage and retention remain separate.

## Verification and activation

Existing local synthetic tests cover signatures, freshness, application/workflow/session correlation, replay/stale-event handling, sandbox rejection and required successful checks. They do not replace the provider's live test.

Use provider sandbox tools first without granting production identity status. Sandbox events must never verify real app accounts. After the founder approves live processing, deploy configured secrets and DIDIT_ENABLED=true, have the founder explicitly complete one real hosted check, and verify the signed callback updates only its matching account. Check decline/review/expired outcomes and publishing/participation gates. Do not manually mark real users verified. Do not claim identity checks guarantee personal safety.

## Sources

- Pricing: https://didit.me/pricing/
- API/session flow: https://docs.didit.me/integration/api-full-flow
- Webhook schema/signatures: https://docs.didit.me/integration/webhooks
- Legal/privacy documents: https://didit.me/terms/
- Verification retention: https://help.didit.me/data-privacy/delete-verification-data
- Data use settings: https://help.didit.me/data-privacy
