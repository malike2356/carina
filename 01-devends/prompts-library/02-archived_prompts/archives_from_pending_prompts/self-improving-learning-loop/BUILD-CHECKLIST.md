# Carina self-improving learning loop build checklist

**Updated:** 2026-07-28

## Phase 1; evaluator

- [x] Add the turn evaluator prompt
- [x] Teach it to score reusability, safety, and regression risk
- [x] Require JSON output only

## Phase 2; synthesizer

- [x] Add the skill synthesizer prompt
- [x] Make it generate one clean reusable artifact
- [x] Keep the output compact and merge friendly

## Phase 3; gate

- [x] Add the duplicate and regression gate
- [x] Require merge or revise when overlap exists
- [x] Require human review for risky changes

## Phase 4; writer

- [x] Add the skill writer prompt
- [x] Keep the markdown body simple and canonical
- [x] Preserve approved scope exactly

## Phase 5; regression

- [x] Add the post-write regression tester
- [x] Verify happy path, near miss, duplicate overlap, and unsafe overreach
- [x] Archive the prompt pack only after the code path is wired
