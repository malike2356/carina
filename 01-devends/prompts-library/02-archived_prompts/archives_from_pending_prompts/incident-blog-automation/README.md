# Incident blog automation

**Updated:** 2026-07-28
**Status:** COMPLETED

## Purpose

This prompt pack upgrades the Labyrinth Scout incident blog so it can:

1. discover new incidents more reliably
2. curate drafts with source-backed evidence
3. support optional auto-approval rules
4. publish and notify subscribers automatically when allowed
5. keep the workflow auditable and reversible

The goal is not to publish unvetted content. The goal is to make the research and distribution pipeline effective enough that important incidents do not get missed, while still preserving source quality and operator control.

## Execution order

| # | File | Outcome |
|---|---|---|
| 01 | `01-discovery-audit.md` | Map the current discovery pipeline, its gaps, and its failure modes |
| 02 | `02-source-expander.md` | Broaden the incident discovery logic so current events are found more reliably |
| 03 | `03-auto-approval-policy.md` | Add configurable auto-approve and auto-publish rules with safety thresholds |
| 04 | `04-subscriber-dispatch.md` | Wire publish events to subscriber outreach and digest delivery |
| 05 | `05-admin-ui-controls.md` | Add ops controls for schedules, confidence thresholds, and newsletter behavior |
| 06 | `06-regression-tester.md` | Verify discovery, approval, publish, and subscription behavior end to end |

## Target code paths

- `carina/02-backends/core.carinaai.uk/src/api/incident-blog.ts`
- `carina/02-backends/core.carinaai.uk/src/blog/research-runner.ts`
- `carina/02-backends/core.carinaai.uk/src/blog/research-filters.ts`
- `carina/02-backends/core.carinaai.uk/src/blog/newsletter-send.ts`
- `carina/02-backends/core.carinaai.uk/src/blog/store.ts`
- `carina/02-backends/core.carinaai.uk/src/agents/checks/incident-research-check.ts`
- `carina/02-backends/core.carinaai.uk/src/index.ts`
- `carina/03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/page.tsx`
- `carina/03-frontends/client-apps/app.carinaai.uk/src/components/...` for any new settings controls

## Operating rules

- Keep the blog draft-first by default
- Never auto-publish if the incident lacks credible sources
- Prefer corroborated sources over single-source claims
- Do not let subscriber dispatch happen before confirmation or opt-in is present
- Keep all content generation source-backed and reviewable
- Make schedule, approval, and dispatch behavior configurable from ops

## Build guidance

Use this pack only for the incident blog automation work.
Do not merge these prompts into unrelated packs.
