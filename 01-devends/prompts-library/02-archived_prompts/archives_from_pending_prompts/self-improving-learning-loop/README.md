# Carina self-improving learning loop

**Updated:** 2026-07-28
**Status:** COMPLETED

## Purpose

This prompt pack upgrades Carina's learning path from single-turn skill capture to a staged review loop:

1. evaluate the turn
2. synthesize a reusable skill or prompt delta
3. gate for duplication and regression risk
4. write the approved artifact
5. run a post-write regression check

The goal is not free-form self-modification. The goal is controlled improvement with auditability, merge awareness, and rollback clarity.

## Execution order

| # | File | Outcome |
|---|---|---|
| 01 | `01-turn-evaluator.md` | Decide whether a completed turn is worth capturing |
| 02 | `02-skill-synthesizer.md` | Turn an approved candidate into a reusable artifact |
| 03 | `03-duplicate-and-regression-gate.md` | Prevent overlap, drift, and unsafe scope expansion |
| 04 | `04-skill-writer.md` | Write the approved markdown artifact cleanly |
| 05 | `05-post-write-regression-tester.md` | Validate the new artifact against known scenarios |

## Build notes

- Use this pack only for the legacy Carina learning loop.
- Keep the learning loop additive, not autonomous.
- Do not save raw chat transcripts as reusable skills.
- Prefer canonical merge over duplicate prompt files when an existing artifact already covers the behavior.

## Related code paths

- `carina/app/Services/Carina/CarinaSessionEvaluatorService.php`
- `carina/app/Jobs/Carina/CarinaSkillAutoLearnJob.php`
- `carina/app/Services/Carina/CarinaSkillWriterService.php`
- `carina/app/Services/Carina/CarinaAgentService.php`
