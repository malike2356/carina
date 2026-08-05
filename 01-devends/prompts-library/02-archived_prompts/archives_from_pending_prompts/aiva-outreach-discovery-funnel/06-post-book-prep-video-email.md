# 06: Post-book prep video email

**Status:** PENDING
**Priority:** P0
**Depends on:** 05
**Unlocks:** 07, 10

## Goal

As soon as a discovery slot is booked, the prospect receives an email with a prep video link (YouTube preferred) so they understand the offer before the call.

## Why

Jak wants pre-call education on phone-friendly devices. YouTube link is the professional, compatible default.

## Reuse first

- `gmail-send` confirmation template
- Documents vault for template + video URL
- YouTube: Jak hosts video on his outreach-oriented channel; Aiva only stores URL until auto-publish (10)

## Requirements

1. Workspace config keys: `prep_video_url`, `prep_video_title`, optional `prep_video_password` (none by default).
2. On successful calendar create:
   - send confirmation email: time, timezone, Join link, prep video URL, reschedule instructions
   - video is a normal HTTPS YouTube watch or youtu.be link (no attachment required)
3. Idempotent: one confirmation per `event_id`.
4. If video URL missing: still send booking confirmation; warn owner to set prep video URL.
5. Template copy: short, mobile-friendly, no emoji, no em/en dashes.
6. Tests for template rendering and skip-when-already-sent.

## Acceptance criteria

- [ ] Booked lead receives email containing clickable YouTube URL within the same automation turn as booking.
- [ ] Missing URL does not block calendar create; owner is alerted.
- [ ] Second run for same event does not duplicate the confirmation.

## Deploy

Core on book hook; Document seed for Jak’s video URL once he publishes.
