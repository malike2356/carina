# 05: Public book page and embed (cloud Aiva)

**Status: COMPLETED 2026-08-04**

## What was built

- Cloud public `/book/[slug]`, thanks, manage, embed APIs.
**Priority:** P1 (P0 for productised sharing; chat offer can ship earlier)
**Depends on:** 04
**Unlocks:** marketing links, embed on sites, funnel public book

## Goal

Ship a guest-facing booking UX equivalent to Propreneur `/book/{slug}` (stepper: Session → Date/time → Details → Confirm) plus iframe embed, using Hire Aiva / Carina cloud frontend, backed by prompt 04 public APIs.

## Reuse first

- Propreneur views: `resources/views/tenant/vical/public-book*.blade.php`, thanks/cancel/reschedule, embed.
- Help: `resources/docs/help/vcal-bookings/01-vcal-overview.md` (10.4 Public Booking Page).
- Cloud app routing conventions under `app.carinaai.uk`.
- Outreach chat offer remains valid; this prompt adds **shareable URL** parity.

## Requirements

1. Public route e.g. `/book/{workspaceSlug}` or `/book/{publicBookingSlug}` resolving host publish slug.
2. Multi-step UI without card spam in hero sense; keep one job per step (select type, pick slot, enter details, confirm).
3. Show timezone clearly (`Europe/London` default label).
4. On submit: re-check slot; create booking; redirect to thanks with token.
5. Guest cancel + reschedule pages by token.
6. ICS download link on thanks (formatter can land with 09 if needed; minimum: Google Calendar deep link OK with note).
7. Embed route `/book/embed/{slug}` suitable for iframe; document snippet in hub (06).
8. Mobile-usable layout; no dependency on host being logged in.
9. Abuse basics: rate limit public POST; honeypot or similar light bot friction without blocking real guests.
10. Writing style and a11y: labels, errors ("that slot just filled; pick another").

## Integration with existing booking system

- Same booking rows as agent/API create.
- If outreach confirm happens in parallel, slot engine + locks prevent double book (02/03).

## Acceptance criteria

- [ ] Guest can complete a booking with only the public link.
- [ ] Embed loads in iframe without broken CSP for same product domain policy.
- [ ] Token cancel works; already-cancelled is idempotent messaging.
- [ ] Confirmed booking appears in host list API / hub (06).

## Deploy

Cloud frontend + public routes on workspace hosting; ensure SEO noindex on book pages if product prefers.
