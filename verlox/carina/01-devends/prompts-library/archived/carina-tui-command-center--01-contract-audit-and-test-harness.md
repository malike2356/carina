---
id: 2026-07-13_carina_tui_command_center_01_contract_audit
title: Carina TUI Command Center 01, contract audit and test harness
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--01-contract-audit-and-test-harness.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 02-backends/core.carinaai.uk/scripts
depends_on:
  - carina-tui-command-center--README.md
tags:
  - carina-tui
  - test-harness
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui
---

# Prompt 01: Contract Audit and Test Harness

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added `src/tui/contracts/command-center-contract.ts` with the 11-area Carina Command Center contract matrix.
- Added `src/tui/command-center/contract-report.ts` and contract tests.
- Added `scripts/check-tui-command-center.sh` for focused TUI validation and progress reporting.
- Added `docs/tui-command-center.md` documenting the contract and check command.

## Objective

Create the foundation that lets every later Carina TUI upgrade be measured. Build a Carina-native parity and surpass contract suite based on the current Keprix TUI capability model, but do not copy Keprix look, labels, or user-facing language.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/contracts/`
- `02-backends/core.carinaai.uk/src/tui/command-center/`
- `02-backends/core.carinaai.uk/src/tui/*.test.ts`
- `02-backends/core.carinaai.uk/src/tui/ink/**/*.test.tsx`
- `02-backends/core.carinaai.uk/scripts/check-tui-command-center.sh`
- `02-backends/core.carinaai.uk/docs/tui-command-center.md` if docs exist locally

## Implementation Prompt

Audit the current Carina TUI implementation in:

- `src/tui/app.ts`
- `src/tui/ink/app.tsx`
- `src/tui/ink/components`
- `src/tui/ink/slash-catalog.ts`
- `src/tui/slash-commands.ts`
- `src/tui/panels`
- `src/tui/status-bar.ts`
- `src/tui/responsive-frame.ts`
- `src/tui/terminal.ts`

Create a contract matrix that defines the Carina Command Center target:

1. Command registry and slash fallthrough.
2. Runtime transport proximity.
3. Renderer contracts and benchmarks.
4. Command Center cockpit.
5. Runtime timeline.
6. Tool cards with redaction and details.
7. Session map and branch navigation.
8. Review mode, search, export, and copy.
9. Debug overlay.
10. Fault injection, long-session behavior, terminal matrix, and overlay recovery.
11. Carina splash, logo, appearance, and marketing alignment.

Build tests that can fail before the later prompts are implemented without making the entire suite red by default. Use one of these patterns:

- Contract data tests that document missing capabilities with `status: "missing"` and assert the audit report is accurate.
- Focused test files with skipped tests and explicit TODO references.
- A script that reports progress without failing until a later prompt turns each area on.

Add `scripts/check-tui-command-center.sh` to run the final TUI validation set once prompts are complete. The script should initially run existing TUI tests and print a contract progress table.

## Acceptance Criteria

- A Carina Command Center contract exists in source, not only in a prompt.
- The contract lists all 11 prompt areas and maps them to current files.
- Existing TUI tests still pass.
- The check script runs without requiring production secrets.
- No shipped string mentions Keprix or Hermes.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
bash scripts/check-tui-command-center.sh
```
