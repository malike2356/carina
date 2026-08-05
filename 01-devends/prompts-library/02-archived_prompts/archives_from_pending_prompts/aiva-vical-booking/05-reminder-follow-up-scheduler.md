# Reminder and follow-up scheduler

Build the reminder system for booked leads and missed leads.

## Scope

- Send reminders before the call:
  - 24 hours before
  - 1 hour before
  - optional custom reminder windows
- Support different reminder templates for:
  - discovery call
  - sales call
  - internal follow-up
- If a lead no-shows, automatically move it to a follow-up state.
- If a lead reschedules, cancel stale reminders and create new ones.
- Add operator alerts when a booking is close or missed.
- Add a timeline entry for every reminder sent or skipped.

## Deliverables

- Reminder scheduler
- Reminder templates
- No-show handling
- Reschedule cleanup
- Operator notification path
- Tests for reminder timing and cancellation

## Acceptance criteria

- Reminders are not sent after cancel or reschedule.
- No-show can automatically trigger follow-up status.
- Operators can see what reminders were sent.
