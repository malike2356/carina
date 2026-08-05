# Outreach sequence engine

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

Build the outbound outreach engine for lead campaigns.

## Scope

- Add a sequence engine that can send outbound messages in steps.
- Support:
  - first touch
  - follow-up 1
  - follow-up 2
  - follow-up 3
  - stop on reply
  - stop on booking
  - stop on unsubscribe
  - stop on manual pause
- Support email as the default channel.
- Leave hooks for WhatsApp, Telegram, and SMS, but do not hardcode them if not available.
- Each sequence step must support:
  - subject
  - body
  - delay
  - channel
  - optional attachment or link
  - optional CTA
- Add scheduling so messages are sent only in allowed business hours and respect timezone.
- Add rate limiting and retry behavior.
- Add logging for sent, delivered, bounced, failed, replied, and unsubscribed events.

## Deliverables

- Sequence model or equivalent
- Send job or worker
- Delivery log table
- Retry and backoff handling
- Tests for scheduled sending, stop conditions, and event logging

## Acceptance criteria

- A campaign can have multiple scheduled outbound steps.
- If a lead replies, the sequence stops immediately.
- If a lead books, the sequence stops immediately.
- Delivery state is visible in the lead timeline.
