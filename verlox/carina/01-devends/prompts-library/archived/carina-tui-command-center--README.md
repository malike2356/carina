---
id: 2026-07-13_carina_tui_command_center_readme
title: Carina TUI Command Center parity and surpass pack
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--README.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 02-backends/core.carinaai.uk/src/tui/ink
  - 03-frontends/marketing/carinaai.uk
  - logo
depends_on: []
tags:
  - carina-tui
  - command-center
  - keprix-parity
validation:
  - cd 02-backends/core.carinaai.uk && pnpm typecheck && pnpm test
---

# Carina TUI Command Center Parity and Surpass Pack

**Status: COMPLETED 2026-07-13**

**What was built:**

- Completed and archived prompts 01 through 11.
- Added a source-level Command Center contract and final check script reporting 11 of 11 areas present.
- Upgraded Carina TUI command registry, transport, renderer, cockpit, timeline, tool cards, session map, review mode, debug overlay, fault tests, splash, and marketing section.

## Goal

Upgrade Carina TUI until it closes the current gap against Keprix TUI and becomes a Carina-native Command Center. Adopt the proven Keprix capability model and operator ergonomics, but keep Carina naming, Carina product boundaries, Carina splash identity, and Carina visual language.

The implementation must not make Carina look like Keprix on the surface. It should feel like Carina with stronger terminal capabilities.

## Current Baseline

Carina already has:

- Ink chat TUI with streaming, sessions, model picker, approvals, clarify prompt, sudo indicator, Agent overlay, Scout overlay, and skins.
- Older operator TUI with tabs for sessions, tasks, processes, tools, logs, chat, side panels, and status bar.
- Slash catalog with fuzzy menu, descriptions, and CLI catalog suggestions.
- TUI tests for layout, terminal utilities, slash commands, skins, launcher responsiveness, and operator helpers.

Keprix currently has stronger:

- Command Center cockpit.
- Runtime timeline.
- Tool cards with redaction and expansion.
- Session map.
- Review mode.
- Debug overlay.
- Slash registry metadata and backend fallthrough contracts.
- Renderer contracts and benchmarks.
- Fault injection and long-session tests.
- Runtime transport abstraction.

## Logo and Brand Input

Use the Carina logo assets in:

- `logo/carina-logo_carina-logo-black-on-white.png`
- `logo/carina-logo_carina-logo-on-dark-blue.png`
- `logo/carina-logo_carina-logo-on-or-trans.png`
- `logo/carina-logo_carina-logo-on-white.png`
- `logo/carina-logo_carina-logo-whiet-on-black.png`

Use them where appropriate for the Carina TUI splash and the marketing site. Do not force bitmap images into terminal views if the terminal cannot render them cleanly. In the TUI, prefer an ASCII or ANSI Carina splash derived from the logo shape and colors. In the marketing site, use the best suitable logo file as a real image asset.

## Hard Rules

- Keep all shipped UI, docs, CLI help, logs, and error text Carina-native.
- Do not expose Keprix, Hermes, OpenClaw, Odysseus, or competitor names in shipped strings.
- Maintain the Carina name splash.
- Use Carina theme names and Carina voice. See `01-devends/prompts-library/docs/REUSE-RULES.md`.
- Do not break current chat, approvals, Scout overlay, model picker, session switcher, or operator tabs.
- Do not remove the older operator TUI unless the replacement preserves every useful workflow.
- Keep changes covered by tests.
- No em dashes, en dashes, or emojis in code comments, docs, prompts, UI copy, or logs.

## Execution Order

Run these prompts in order:

1. `carina-tui-command-center--01-contract-audit-and-test-harness.md`
2. `carina-tui-command-center--02-command-registry-and-slash-fallthrough.md`
3. `carina-tui-command-center--03-runtime-transport-proximity.md`
4. `carina-tui-command-center--04-renderer-contracts-and-benchmarks.md`
5. `carina-tui-command-center--05-command-center-cockpit-and-status.md`
6. `carina-tui-command-center--06-runtime-timeline.md`
7. `carina-tui-command-center--07-tool-cards-redaction-and-details.md`
8. `carina-tui-command-center--08-session-map-and-branch-navigation.md`
9. `carina-tui-command-center--09-review-mode-search-export-copy.md`
10. `carina-tui-command-center--10-debug-overlay-faults-and-long-session-tests.md`
11. `carina-tui-command-center--11-visual-upgrade-splash-logo-and-marketing.md`

## Completion Standard

The pack is complete only when:

- The Carina TUI can be described as a Carina Command Center, not only a chat UI.
- Every current Keprix TUI advantage has an equivalent or better Carina-native implementation.
- `pnpm typecheck` and relevant TUI tests pass in `02-backends/core.carinaai.uk`.
- A new Carina TUI parity script reports all required contracts passing.
- Marketing accurately presents the upgraded Carina TUI using the Carina logo assets.
- The implementation is archived according to `01-devends/prompts-library/docs/POST-BUILD-CHECKLIST.md`.
