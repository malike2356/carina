# Kanban board and lead timeline UI

Build the operational UI for managing the funnel.

## Scope

- Add a kanban board showing every lead by pipeline stage.
- Allow drag and drop or quick action moves between states.
- Add filters for:
  - campaign
  - owner
  - source
  - reply state
  - booking state
  - due follow-up
- Add a lead detail panel with:
  - full timeline
  - reply history
  - sent messages
  - bookings
  - notes
  - next action
- Add quick actions:
  - mark replied
  - book call
  - send follow-up
  - mark won
  - mark lost
  - mark ghosted
- Add a dashboard summary:
  - total leads
  - contacted
  - replied
  - booked
  - attended
  - won
  - lost
  - follow-ups due

## Deliverables

- Kanban UI
- Lead detail view
- Filters and search
- Summary metrics
- Tests for stage rendering and action handling

## Acceptance criteria

- An operator can manage the whole funnel from one screen.
- Every state change is visible in the lead timeline.
- The UI clearly shows what needs attention next.
