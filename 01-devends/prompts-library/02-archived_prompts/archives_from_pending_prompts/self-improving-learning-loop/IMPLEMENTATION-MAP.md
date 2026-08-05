# Carina self-improving learning loop implementation map

**Updated:** 2026-07-28

## Current code anchors

| Stage | Existing code to anchor on | Missing or weak points |
|---|---|---|
| 01 evaluator | `carina/app/Services/Carina/CarinaSessionEvaluatorService.php` | Implemented staged scoring, synthesis, gating, and regression checks |
| 02 dispatch | `carina/app/Services/Carina/CarinaAgentService.php` | Implemented guarded capture dispatch for completed turns |
| 03 writer | `carina/app/Services/Carina/CarinaSkillWriterService.php` | Implemented canonical merge-aware writing and metadata hygiene |
| 04 job | `carina/app/Jobs/Carina/CarinaSkillAutoLearnJob.php` | Implemented the full staged learning pipeline |
| 05 prompt library | `carina/01-devends/prompts-library/01-pending_prompts/` | Completed and ready for archive |

## Target behavior

- Capture only useful turns
- Prefer merging into existing skills
- Write only approved artifacts
- Validate after write
- Keep the loop operator controlled
