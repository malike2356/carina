# 03: Cold email send cadence and warm-up

**Status:** PENDING
**Priority:** P0
**Depends on:** 01, 02
**Unlocks:** 04, 10

## Goal

Aiva sends cold outreach from the connected business Gmail at a capped daily rate toward a weekly Sunday reach target, with approvals and warm-up-safe defaults.

## Why

Jak starts ~10/day and ramps while warming `salesgridai.com`. Sunday target frames the week.

## Reuse first

- `gmail-send`, `gmail-list`, `gmail-get`
- `workspace-email-draft-for-approval` (mandatory until owner enables auto-send)
- `worker-automation` for daily send windows
- Sheet status updates via `google-sheets-append` or a dedicated update action if missing (add `google-sheets-update` if append-only cannot mark rows)

## Requirements

1. Cadence config (per workspace):
   - `daily_cap` default 10
   - `weekly_target` (optional)
   - `send_window` local TZ (Europe/London default)
   - `from_email` must match granted mailbox
   - `require_approval` default true for first 14 days / until owner flips
2. Template store in Documents (subject + body with merge fields: `{business_name}`, `{contact_name}`, `{booking_link}`).
3. Daily job picks `status=queued` rows up to remaining daily_cap; drafts or sends; sets `status=contacted` and `last_touch_at`.
4. Never exceed daily_cap even if weekly_target is behind; report deficit to owner instead.
5. Include plain-text stop language and professional signature; no emoji spam.
6. Soft bounce / invalid address: mark `dead` or `nurture` with note; do not retry endlessly.
7. Track week progress: contacted count vs weekly_target; Sunday digest automation.
8. Safety: bulk send must not bypass tool danger / confirmation flags unless an explicit workspace policy enables them and is audited.
9. Tests for cap math and template merge.

## Acceptance criteria

- [ ] With approval on, 10 drafts/day is the max auto-queued action.
- [ ] After approval send, sheet row becomes `contacted`.
- [ ] Asking "how many left to hit Sunday target" returns number from sheet + sends this week.
- [ ] Wrong from-mailbox attempt fails honestly.

## Deploy

Core for cadence helpers / sheet update; Automation config on pilot.
