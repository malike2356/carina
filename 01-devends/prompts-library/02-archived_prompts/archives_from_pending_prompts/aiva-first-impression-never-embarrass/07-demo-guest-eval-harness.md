# 07: Demo-guest golden eval harness

**Status:** PENDING
**Priority:** P0
**Depends on:** 01, 02, 03, 04, 06
**Unlocks:** 09

## Goal

A repeatable golden suite that fails CI (or a nightly Contabo smoke) if first-impression paths regress. Never rely on hope before a Salim-class live walkthrough.

## Why

Without golden asks pinned, every deploy can reintroduce blank replies. Founder embarrassment is a regression class worth automated defence.

## Files to create/change (expected)

- Vitest integration tests under Core and/or cloud API tests
- Optional script: `carina/scripts/smoke-aiva-first-impression.sh` (Contabo SSH or local)
- Fixture workspace strategy: prefer mocked grants + mocked LLM rather than live OpenAI spend in CI

## Golden cases (must pass)

| ID | Channel | Setup | User message | Must include | Must not include |
|---|---|---|---|---|---|
| G1 | web | new worker, no tools | `hi` | capability intro / welcome | unable to respond; empty |
| G2 | web | no calendar grant | `check my calender for hospital meetings` | connect Calendar + Tools URL | unable to respond; "I checked" |
| G3 | web | calendar connected | `what is on my calendar tomorrow?` | tool attempt or real schedule summary | reconnect CTA |
| G4 | telegram | gmail needs_reauth | retrospective email search ask | reconnect Gmail | "What would you like me to help with?" |
| G5 | worker tools | large docs in vault | DBA November readiness list | vault titles present | "not indexed" when titles exist |
| G6 | web | signup complete | open chat without typing | welcome seed exists (04) | blank thread |

## Requirements

1. Automate G1, G2, G4, G5 in Vitest with mocks as far as practical.
2. Document G3/G6 as Contabo manual smoke in 09 if hard to mock fully.
3. Fail if banned strings appear in outputs for G1/G2/G4.
4. Keep tests free of real secrets.

## Acceptance criteria

- [ ] `pnpm test` (or named vitest file) covers G1/G2/G4/G5.
- [ ] Script or README steps exist for Contabo G3/G6.
- [ ] One intentional break test proves suite catches banned fallback text.

## Deploy

CI/local only until 09 cutover.
