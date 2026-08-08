# 06: Contact leads on ask (outbound with Soft Wall)

**Status: COMPLETED 2026-08-08**
**Priority:** P0
**Depends on:** 02, 04
**Unlocks:** 07
**Writing style:** plain ASCII only.

## What was built
- `outreach-contact-leads` queues Soft Wall Approvals drafts (no silent send)
- Pause control respected; missing-email skip counts; optional sequence enroll

## Goal

When the user asks Aiva to contact CRM leads (web or any channel), Aiva selects the right leads, drafts outreach, enrolls cadence if needed, and sends only through Soft Wall / Approvals. Visible leads in the table update stage and timeline.

## Why

Seeing leads is useless if Aiva cannot act on "email these leads" safely.

## Reuse first

- Outreach enrollments, sequences, process-due
- Gmail / channel send tools with Soft Wall
- Approvals UI
- Keprix `outreach.*` / Soft Wall nodes if used
- viCal booking offer when discovery call requested

## Requirements

1. **Intent → plan**
   - Parse scope: all new leads, filter by stage/source/campaign, named lead, "leads from today's import".
   - Cap batch size (config; default conservative e.g. 10/day remaining budget).
   - Confirm plan to owner on channel (count, channel, template) unless explicit "just do it" and policy allows Soft Wall queue without chat confirm.

2. **Execution**
   - Create Soft Wall drafts (email or configured channel); never silent blast.
   - Enroll in sequence when multi-step requested.
   - Update lead stage to `queued`/`contacted` as appropriate when released/sent.
   - Timeline entries for propose / approved / sent / failed.

3. **UI feedback**
   - CRM Leads table shows updated stages.
   - Approvals page lists pending outreach drafts with deep links.

4. **Stop / compliance**
   - Honour unsubscribe / stop language.
   - Skip leads missing email (or phone for SMS) with reported count.
   - Pause control respected (`outreach` pause).

5. **Tests**
   - Ask-to-contact creates Soft Wall items, not direct send.
   - Paused outreach refuses with clear message.

## Acceptance

- [ ] "Contact my new leads about a discovery call" queues Soft Wall drafts and updates leads.
- [ ] Owner can approve from Approvals; lead timeline shows send.
- [ ] Works from web worker chat and Telegram after prompt 04.

## Done When

Aiva can contact visible CRM leads on request under Soft Wall, end to end.
