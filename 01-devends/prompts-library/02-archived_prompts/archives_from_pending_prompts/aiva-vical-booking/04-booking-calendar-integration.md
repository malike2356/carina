# Booking and calendar integration

Build the booking phase that happens after a lead expresses interest.

## Scope

- Add a booking module that exposes available slots from the connected calendar.
- Prevent double booking.
- Support:
  - discovery call booking
  - reschedule
  - cancel
  - no-show mark
- Booking must write to the calendar and to the lead timeline.
- Booking must send confirmation by email.
- Booking page should be simple and mobile friendly.
- Add reminder scheduling when a booking is created.
- Add meeting metadata:
  - start time
  - end time
  - attendee
  - host
  - calendar provider
  - join link if available
  - booking status

## Deliverables

- Calendar availability lookup
- Slot reservation logic
- Booking confirmation flow
- Reschedule and cancel flow
- Tests for conflict prevention and booking persistence

## Acceptance criteria

- Two people cannot book the same slot.
- Booking creation updates both the calendar and the lead record.
- Booking confirmation is sent automatically.
