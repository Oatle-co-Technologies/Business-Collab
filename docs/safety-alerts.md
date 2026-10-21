# Founder email and automatic safety checks

## Purelymail settings

In Vercel → business-collab → Settings → Environment Variables, choose Production and add:

| Name | Value |
| --- | --- |
| `SMTP_USER` | `founder@oatle-technologies.co.za` |
| `SMTP_FROM` | `founder@oatle-technologies.co.za` |
| `SMTP_PASSWORD` | The mailbox's SMTP password, entered privately as a sensitive secret |
| `SAFETY_EMAIL_ENABLED` | `true` only when ready to test delivery |

Redeploy after changing settings. Do not paste passwords into chat or commit them. SMTP uses `smtp.purelymail.com`, implicit TLS on port 465, certificate verification and bounded connection timeouts. The recipient is read from the existing account pinned by `SAFETY_FOUNDER_USER_ID`; browser forms cannot choose recipients. No new mailbox is created.

## Scheduling

The current Vercel team is Hobby. Its daily cron limit cannot provide five-minute safety checks. No paid upgrade or third-party scheduler account has been created. A separately approved scheduler must call:

- GET `https://business-collab.vercel.app/api/cron/maintenance`
- Every five minutes, with HTTPS certificate verification, no redirects and no cached responses.
- Header `Authorization: Bearer <CRON_SECRET>`; use the exact production secret privately. It is deliberately not shown here or in chat. Because it was stored as a sensitive secret, rotate it securely if its original value is unavailable, and update both the scheduler and Vercel together.
- Alert the founder on non-2xx responses or missed invocations. Keep response-body storage off and never put credentials in the URL.

The scheduler can see the endpoint and bearer credential; no case details are returned. Protect its account. Do not use a browser tab, laptop process or daily job as a substitute for hosted scheduling. Vercel's own cron can be configured every five minutes if the founder explicitly authorises a suitable paid plan later.

## Delivery behaviour

Each safety case gets one durable queue row alongside the founder's in-app notification. Workers acquire a two-minute lease, send at most three emails per invocation, and mark SMTP acceptance separately from in-app notification. Failed sends remain queued, with backoff from one minute up to one hour. A case already acknowledged or resolved is not picked up for email. The founder inbox shows pending notices and whether email is configured.

Emails contain only a generic subject, a notice and a link to `/safety`; no names, addresses, attendance identifiers or report contents. SMTP acceptance does not prove inbox delivery, reading or response. Delivery is at least once: a process failure after SMTP acceptance and before database confirmation can cause a duplicate despite the stable Message-ID. There is no 24-hour response service or automatic emergency-service contact.

## Activation check

After credentials and an approved scheduler are configured, redeploy, send a clearly marked test safety report and confirm it reaches only the founder, shows as accepted in the queue, and contains no private case details. Verify failed sends retry and the scheduler alerts on failures. This live delivery test has not yet been performed; unit tests use a fake sender and never contact Purelymail. Keep live identity verification disabled until its separate setup is complete.

## Approved external scheduler preparation

The founder approved preparing a free external scheduler. Use a founder-controlled cron-job.org account. `safety-scheduler.template.json` matches its documented REST job format and remains disabled with a placeholder secret. It schedules every five minutes in Africa/Johannesburg, retains no response bodies and notifies only the account's built-in email channel on failure/recovery/automatic disablement. Replace the header secret privately, confirm the account email is the founder's, run a successful manual execution, then enable the job. A template alone is not an active schedule. No third-party account or job has been created yet.

References: https://cron-job.org/en/faq/ and https://docs.cron-job.org/rest-api.html . The service is free and supports custom headers and failure notifications; do not describe it as guaranteed emergency monitoring.

## Scheduler activation

cron-job.org job `8666597` is enabled for every five minutes in Africa/Johannesburg, with private bearer authentication and response storage off. Production deployment `dpl_8cdEVBrSp8VZBDNb1yHTGTFXeWQ1` contains the matching rotated scheduler secret. A direct authenticated maintenance invocation returned 200 with `ok:true,emailEnabled:false`. Scheduler failure/recovery/auto-disable notices currently target the account email `info@oatle-technologies.co.za`, which the founder confirmed is privately owned. A dedicated `founder@oatle-technologies.co.za` channel was added but needs the emailed confirmation before routing can switch. The scheduler console's manual test action was disabled; first scheduled-execution confirmation is pending. SMTP alerts remain disabled pending private credentials and an end-to-end email test.

Founder channel confirmation was completed and saved as the sole selected scheduler notification channel. Automatic scheduler execution succeeded at 21:35 SAST. Production deployment dpl_BJn29p7fx7GxyMZRzPQ1LWU45LHN enabled SMTP using the privately entered password. A clearly marked temporary delivery case was processed by the hosted maintenance endpoint (200, emailEnabled:true); SMTP accepted it on attempt one with sentAt recorded and no failure. The temporary case and queue were removed. Inbox placement and human reading are not established by SMTP acceptance.
