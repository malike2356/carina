# Phase 03: Conversion -- Calendar Booking, Video, Reminders

**Status:** Build after Phase 02 (responses flowing in)
**Target:** 4 prompts, 1 week.

---

## Prompt 03-01: Calendar Booking Engine

**Depends on:** 02-04 (response handler detecting positive replies)
**Target time:** 8 hours

### What This Builds

When a lead responds positively, Aiva sends them a booking link. The lead picks a time slot. Google Calendar is updated. No double-booking. Papa Lord's availability is respected.

### Implementation

Use Aiva's existing Google Calendar integration. Create a scheduling layer on top:

1. Papa Lord configures availability: "I can do meetings Mon-Thu 6pm-9pm, Sat 10am-2pm"
2. Aiva generates available slots (default: 30 min each, 15 min buffer between)
3. When a lead responds positively, Aiva sends: "Great! Pick a time that works for you: [link]"
4. Booking link shows available slots. Lead picks one.
5. Google Calendar event created with: lead name, company, campaign source, meeting link (Google Meet)
6. Slot removed from availability. No double-booking.
7. Lead status: 'responded' -> 'booked'

### Key Deliverables

- Availability config: Papa Lord sets his available hours via Telegram
- Slot generation: creates 30-min slots within available windows
- Booking page: simple public page showing available slots (hosted by Aiva)
- Calendar event creation: Google Calendar with lead details + Google Meet link
- Booking confirmation: email to lead + Telegram notification to Papa Lord
- Buffer time: 15 min between meetings (configurable)
- Blackout dates: Papa Lord can block specific dates
- Telegram commands:
  - `/availability set Mon 6pm-9pm Thu 6pm-9pm Sat 10am-2pm`
  - `/availability show`
  - `/availability block Friday` (block this Friday)

### Files to Create

- `src/workers/product-tools/outreach/calendar/availability.ts`
- `src/workers/product-tools/outreach/calendar/booker.ts`
- `src/workers/product-tools/outreach/calendar/booking-page.ts` (serves the booking UI)
- Migration: `outreach_availability`, `outreach_bookings` tables

### Acceptance Criteria

- Papa Lord sets availability -> slots generated correctly
- Lead clicks booking link -> sees available slots -> picks one -> calendar event created
- Same slot cannot be double-booked
- Booking confirmation email sent to lead
- Telegram notification to Papa Lord: "John from ABC Properties booked Thu 7pm"
- Google Calendar shows the event with Meet link

---

## Prompt 03-02: Pre-Meeting Video Sender

**Depends on:** 03-01 (booking engine)
**Target time:** 4 hours

### What This Builds

When a lead books a meeting, Aiva immediately sends them a pre-meeting video. The video introduces Papa Lord, explains what the call will cover, and sets expectations. This reduces no-shows and pre-qualifies leads.

### Implementation

1. Papa Lord records a 2-3 minute intro video. Uploads to YouTube (unlisted).
2. Video can also be the property channel's intro content.
3. When booking confirmed, Aiva sends email: "Your call is booked for Thursday 7pm. Before we speak, here's a quick video about what to expect: [YouTube link]"
4. Email template includes: meeting time, meeting link, video link, reschedule link, cancel link.

### Key Deliverables

- Video template: email with embedded YouTube link + meeting details
- Auto-send on booking confirmation
- Video link config: Papa Lord updates the video URL via Telegram: `/video set https://youtube.com/...`
- Reschedule link in email: leads can change their time without emailing
- Cancel link in email: leads can cancel with one click

### Files to Create

- `src/workers/product-tools/outreach/video-sender.ts`
- Update booking confirmation email template

### Acceptance Criteria

- Lead books a call -> receives email with YouTube link within 60 seconds
- Email contains: meeting time, Google Meet link, video link, reschedule link, cancel link
- Papa Lord can update the video URL via Telegram
- Reschedule link works: lead picks new time, calendar updated
- Cancel link works: meeting removed, lead notified

---

## Prompt 03-03: Reminder Engine

**Depends on:** 03-01 (booking engine)
**Target time:** 5 hours

### What This Builds

Automated reminders before meetings. Reduces no-shows. Multiple reminders with increasing urgency.

### Implementation

Cron jobs (Aiva's existing cron system) that check upcoming meetings and send reminders:

1. **24 hours before:** "Reminder: Your call with [Papa Lord] is tomorrow at 7pm. Here's the meeting link: [link]. Need to reschedule? [link]"
2. **1 hour before:** "Your call is in 1 hour. Meeting link: [link]"
3. **15 minutes before:** "Your call starts in 15 minutes. Joining instructions: [link]"

Papa Lord also gets reminders on Telegram:
- "Meeting with John (ABC Properties) in 1 hour"
- "Meeting with John starts in 15 minutes"

### Key Deliverables

- Reminder cron job: runs every 15 minutes, checks upcoming meetings
- Three reminder tiers: 24h, 1h, 15min
- Email template for each tier (increasing urgency)
- Telegram notification to Papa Lord at 1h and 15min
- Reschedule link in every reminder
- No reminder if meeting was cancelled
- Configurable: Papa Lord can change timing or disable reminders per meeting

### Files to Create

- `src/workers/product-tools/outreach/reminders.ts`
- Cron job registration in Aiva's cron system

### Acceptance Criteria

- Meeting tomorrow at 7pm -> reminder email sent at 7pm today
- Papa Lord gets Telegram notification 1 hour before
- Reschedule link in reminder works
- Cancelled meetings generate no reminders
- Reminder timing is configurable

---

## Prompt 03-04: Post-Meeting Follow-Up

**Depends on:** 03-01 (booking engine)
**Target time:** 4 hours

### What This Builds

After a meeting ends, Aiva follows up automatically. Sends a thank-you email. Prompts Papa Lord for meeting outcome. Updates the lead status and pipeline.

### Implementation

After meeting end time (detected via calendar event end):
1. Aiva sends thank-you email to lead: "Great speaking with you today. Here's a summary of what we discussed. I'll follow up with next steps within 48 hours."
2. Aiva messages Papa Lord on Telegram: "How did the meeting with John go? Reply: won / lost / follow-up / send proposal"
3. Based on Papa Lord's response:
   - **won:** Mark lead as 'won'. Move to fulfillment.
   - **lost:** Mark lead as 'lost'. Optional: send "thank you for your time" email.
   - **follow-up:** Schedule follow-up in 3 days. Send "I'll be in touch" email.
   - **send proposal:** Trigger proposal/document generation (Phase 04).
4. Lead status updated: 'meeting_done' -> 'won'/'lost'/'follow_up'

### Key Deliverables

- Post-meeting thank-you email (auto-sent)
- Telegram prompt to Papa Lord for outcome
- Lead status update based on outcome
- Follow-up scheduling (cron-based)
- Meeting outcome log stored on lead record

### Files to Create

- `src/workers/product-tools/outreach/post-meeting.ts`

### Acceptance Criteria

- Meeting ends -> thank-you email sent to lead within 5 minutes
- Papa Lord receives Telegram prompt
- Lead status updated based on Papa Lord's reply
- Follow-up scheduled correctly when requested
