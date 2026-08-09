# Customer Concierge v1 live provider runbook (owner-gated)

**Status:** Owner approval required before any live write  
**Date:** 2026-08-09

## Rule

Hermetic suites with fake OAuth and signed webhook fixtures are the default proof path. **Do not** create live Zoom meetings or calendar events unless the owner explicitly approves named test accounts for that session.

## Before live smoke

1. Confirm owner approval in the session notes (account emails, workspace id, time window).
2. Use a disposable Zoom user and a calendar mailbox that is not a customer production host.
3. Prefer a Contabo staging profile if available; otherwise a dedicated test workspace on production hosts.
4. Capture start time, workspace id, worker id, booking ids, and provider resource ids.

## Live steps (only when approved)

1. Connect Zoom and Google Calendar in Concierge Setup; run connection tests.
2. Publish concierge; embed widget on an allowlisted origin.
3. Book one slot from the widget; confirm Zoom join URL and calendar invitation states in viCal Bookings.
4. Reschedule once; cancel once; confirm provider cleanup and outreach cadence stop.
5. Tear down: cancel remaining bookings; revoke test OAuth if temporary.

## Evidence to keep

- Provider resource ids (Zoom meeting id, Google event id)
- Screenshots or API JSON showing `invitation_sent` vs `accepted` / `delivery_failed`
- Confirmation that host start URLs never appeared in browser payloads or logs

## Rollback

- Cancel the live booking via saga cancel.
- If Contabo app deploy misbehaves, use `docker/scripts/deploy-atomic.sh` rollback for `carina-cloud` / `carina-web` as documented in `docker/DEPLOY.md`.
- Marketing homepage must remain HTTP 200 (`check-carina-marketing.sh`).
