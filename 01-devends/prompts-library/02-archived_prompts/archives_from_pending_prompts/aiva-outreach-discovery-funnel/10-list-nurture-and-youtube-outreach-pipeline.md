# 10: List nurture and YouTube outreach pipeline

**Status:** PENDING
**Priority:** P1
**Depends on:** 02, 03
**Unlocks:** 13 (optional path)

## Goal

Every scrape, reply, and YouTube engagement grows Jak’s owned list. His YouTube channel becomes an outreach content pipeline that feeds comments/leads into the same sheet and nurture sequences.

## Why

Jak wants mailing lists, comment capture, and later co-marketing. He plans to re-purpose the channel for outreach education (including prep videos).

## Reuse first

- Sheet + Contacts tags (`nurture`)
- Property Channel / YouTube connector (OAuth, comment monitor step exists under `property-channel/steps/comment-monitor.ts`)
- Gmail for nurture drips (lower cadence than cold)
- Documents for nurture copy

## Requirements

1. Tag taxonomy: `cold`, `replied`, `booked`, `customer`, `nurture`, `youtube`.
2. Export / snapshot: owner can ask for CSV-style summary via Sheets or Document.
3. YouTube:
   - Store channel connection on workspace
   - Ingest comments that look like lead intent into sheet with `source=youtube_comment`
   - Prep video for booking (06) lives on this channel
4. Do not block P0 email funnel on full Property Channel polish; minimal comment → sheet is enough for P1.
5. Respect YouTube quota and privacy; never auto-spam commenters without approved template.
6. Co-marketing note: list remains Jak’s; platform ads only with explicit owner consent (document policy).

## Acceptance criteria

- [ ] Nurture status leads are excluded from cold daily_cap picks.
- [ ] At least one path: YouTube comment or manual paste → sheet row with youtube source.
- [ ] Prep video URL from this channel works in booking confirmation (06).

## Deploy

Core + optional Property Channel wiring; can ship after P0 booking path.
