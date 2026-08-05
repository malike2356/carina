# Reply router and interest detection

Build the reply handling layer that turns responses into next actions.

## Scope

- Detect inbound replies from email and map them back to the correct lead.
- Classify replies into:
  - positive interest
  - request for more info
  - booking intent
  - objection
  - unsubscribe
  - out of office
  - not interested
  - unknown
- If a reply indicates interest or booking intent, promote the lead to the next stage.
- If a reply asks for a booking, surface the booking step automatically.
- If the reply is ambiguous, flag it for human review.
- Add a manual review queue for uncertain replies.
- Add reply snippets and classification confidence to the timeline.

## Deliverables

- Inbound reply matcher
- Reply classifier
- Manual review queue
- UI or API to inspect reply state
- Tests for matching, classification, and stage promotion

## Acceptance criteria

- A reply can be linked to the right lead.
- A positive reply can move the lead into booking flow.
- Unknown replies are not lost and can be reviewed manually.
