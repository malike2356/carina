# Lead intake, campaign, and pipeline model

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

Build the lead lifecycle foundation for the outreach funnel.

## Scope

- Add first class lead, campaign, and pipeline models.
- A lead must store at least:
  - name
  - email
  - phone
  - company
  - source
  - campaign_id
  - status
  - owner
  - notes
  - tags
  - timezone
  - last_contacted_at
  - next_action_at
  - reply_state
  - booking_state
  - created_at
  - updated_at
- A campaign must store:
  - name
  - objective
  - source type
  - target audience
  - active state
  - cadence settings
  - default booking link
- Define a clear pipeline with statuses:
  - new
  - contacted
  - replied
  - booked
  - attended
  - proposal_sent
  - won
  - lost
  - ghosted
  - follow_up
- Every status change must be audited and visible in a lead timeline.
- Add deduplication rules by email, phone, and normalized domain.
- Add import support for scraped lead batches.

## Deliverables

- Database tables or equivalent persistence layer
- CRUD endpoints or services
- Seed data for a default funnel
- Basic tests for creation, update, dedupe, and status transitions

## Acceptance criteria

- A new lead can be created and assigned to a campaign.
- A lead can move through pipeline states.
- Duplicate leads are detected and linked, not blindly duplicated.
- Timeline history is preserved for every state change.
