# 08: Kanban funnel (Trello first, native later)

**Status:** PENDING
**Priority:** P0
**Depends on:** 04, 05
**Unlocks:** 09, 12

## Goal

Jak can see every lead’s stage on a Kanban board. Week-one boards use **Trello** (already wired). Later, optional native Aiva `kanban-*` parity so owners outgrow third-party tools.

## Why

At volume (hundreds to thousands), chat memory is not enough. Jak and Salim already understand Trello; Aiva already has Trello tools and internal kanban tools.

## Reuse first

- Trello: `trello-list-boards`, `trello-list-lists`, `trello-list-cards`, `trello-create-card`
- Extend Trello adapter if missing: move card, add comment, update desc (add only what funnel needs)
- Native: `kanban-list`, `kanban-show`, `kanban-create`, … (session tool resolution already references them)
- Sheet `status` remains source of truth; Kanban is the human view

## Requirements

1. Standard lists/columns:
   - New / Queued
   - Contacted
   - Replied
   - Booked
   - Showed / In discussion
   - Won
   - Dead
   - Nurture / Follow-up
2. On each status change: create card if missing, else move; card desc includes email, sheet lead_id, last touch, event time.
3. Board/list ids stored in workspace outreach config (Document or settings). Provision helper: "create my outreach Trello board" using existing lists if API allows.
4. Owner can ask: "what stage is X?" / "show booked this week" and Aiva answers from Trello or sheet.
5. Native kanban path (P1): mirror same stages with `kanban-*` for workspaces without Trello.
6. Do not require Notion for P0; optional dual-write later.
7. Tests for stage mapping sheet status ↔ list id.

## Acceptance criteria

- [ ] Contacted send creates/moves Trello card to Contacted.
- [ ] Booking moves card to Booked with event time in desc.
- [ ] "Show my outreach board" lists column counts without inventing cards.
- [ ] Missing Trello grant yields Tools connect CTA (conversational), never blank.

## Deploy

Core Trello move/comment adapters + config; cloud Channels/Trello already exists.
