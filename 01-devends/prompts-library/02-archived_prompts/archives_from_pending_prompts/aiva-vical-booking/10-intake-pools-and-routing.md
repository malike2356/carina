# 10: Intake pools and routing (parity slice)

**Status:** PENDING
**Priority:** P2
**Depends on:** 05 (public book), 03
**Unlocks:** qualified public booking without burning calendar

## Goal

Port Propreneur intake pools: qualify guests before slots, disqualify with friendly message, optionally route to an alternate event type based on answers.

## Reuse first

- Propreneur: `VcalIntakePool` model, `VcalIntakeValidator`, `VcalIntakeRoutingApplicator`, hub intake-pool CRUD, Alpine `vical-intake-questions.js`, help `01-vcal-overview.md` section 10.3.
- Public book stepper: insert intake step before slots when pool attached to event type.

## Requirements

1. Tables: `vcal_intake_pools` (questions JSON, disqualify rules, routing rules) + event type FK.
2. Hub UI to create/edit pools and attach to event types.
3. Public book: show questions; on fail, record attempt (optional table or booking metadata status `disqualified`) and do not show slots.
4. Routing: map answer combinations to another event type id.
5. Agent tools: optional `vical-intake-validate` or include intakeAnswers on create (reject if required and missing).
6. Vitest for disqualify + route + pass.

## Non-goals

- Full survey product.
- Mentorship/learning-path anchors from Propreneur (document as later if Contacts links needed).

## Acceptance criteria

- [ ] Guest with disqualifying answer never receives slots.
- [ ] Passing guest continues to slots for (possibly routed) event type.
- [ ] Host can edit questions without deploy.

## Integration

- Outreach agent path may skip intake (set `source=outreach` bypass) unless owner enables pool on discovery type.
