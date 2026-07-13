---
id: 2026-07-13_carina_tui_command_center_11_visual_marketing
title: Carina TUI Command Center 11, visual upgrade, splash, logo, and marketing
product: carina
capability: tui-command-center
status: completed
source: operator-request
source_chat:
created: 2026-07-13
completed: 2026-07-13
canonical_path: 01-devends/prompts-library/archived/carina-tui-command-center--11-visual-upgrade-splash-logo-and-marketing.md
repo_paths:
  - 02-backends/core.carinaai.uk/src/tui
  - 03-frontends/marketing/carinaai.uk
  - logo
depends_on:
  - carina-tui-command-center--05-command-center-cockpit-and-status.md
  - carina-tui-command-center--10-debug-overlay-faults-and-long-session-tests.md
tags:
  - carina-tui
  - brand
  - marketing
validation:
  - cd 02-backends/core.carinaai.uk && pnpm check && pnpm exec vitest run src/tui && bash scripts/check-tui-command-center.sh
---

# Prompt 11: Visual Upgrade, Splash, Logo, and Marketing

**Status: COMPLETED 2026-07-13**

**What was built:**

- Added a stronger ANSI Carina Command Center splash mark and updated TUI banner copy.
- Added branding tests for the Carina-native Command Center splash.
- Updated the Carina marketing homepage with a logo-backed Command Center section and terminal mock that matches the implemented TUI capabilities.
- Ran the writing-style fixer and marked Carina splash, logo, appearance, and marketing alignment as present in the Command Center contract.

## Objective

Upgrade Carina TUI look and feel so it adopts the strength and density of the Keprix Command Center style while remaining unmistakably Carina. Keep the Carina name splash. Use the new Carina logo assets where they improve the product and marketing presentation.

## Logo Assets

Review and choose the best fit from:

- `logo/carina-logo_carina-logo-black-on-white.png`
- `logo/carina-logo_carina-logo-on-dark-blue.png`
- `logo/carina-logo_carina-logo-on-or-trans.png`
- `logo/carina-logo_carina-logo-on-white.png`
- `logo/carina-logo_carina-logo-whiet-on-black.png`

For terminal UI, do not attempt raw image rendering unless the runtime already supports it reliably. Instead:

- Create an ANSI/ASCII Carina splash inspired by the logo.
- Use Carina blue, cyan, and trust accent colors.
- Keep text readable in dark, light, and no-color modes.

For marketing, use the best logo file as a real image asset and make the upgraded TUI visible in the first product story where appropriate.

## Target Files

- `02-backends/core.carinaai.uk/src/tui/ink/components/Banner.tsx`
- `02-backends/core.carinaai.uk/src/tui/ink/theme/colors.ts`
- `02-backends/core.carinaai.uk/src/tui/ink/theme/tokens.ts`
- `02-backends/core.carinaai.uk/src/tui/skins/built-in.ts`
- `02-backends/core.carinaai.uk/src/tui/ink/launcher/`
- `02-backends/core.carinaai.uk/src/cli/entrance.ts`
- `03-frontends/marketing/carinaai.uk/`
- Any marketing asset folder used by `carinaai.uk`

## Implementation Prompt

Design a Carina Command Center visual system:

- Startup splash with Carina name and logo-derived shape.
- Compact title bar.
- Cockpit styling.
- Clear active focus states.
- Distinct colors for model, tools, approvals, Scout, errors, and runtime health.
- Accessible no-color mode.
- Light terminal support where feasible.
- Consistent skin/theme names following Carina reuse rules.

Upgrade the marketing site:

- Add or refresh a section that presents Carina TUI as a Command Center.
- Use an actual Carina logo asset where appropriate.
- Include a realistic terminal screenshot or generated terminal mock that matches the implemented UI.
- Do not claim capabilities before prompts 01 through 10 are implemented and validated.
- Keep Carina positioning distinct from Keprix and Aiva.

## Acceptance Criteria

- Carina splash remains visible and stronger than before.
- TUI appearance is denser, cleaner, and more operational.
- Themes work with existing skin store.
- No-color mode remains usable.
- Marketing site uses the Carina logo asset cleanly.
- Marketing copy accurately reflects implemented capabilities.
- No shipped text mentions Keprix or Hermes.

## Validation

```bash
cd 02-backends/core.carinaai.uk
pnpm check
pnpm exec vitest run src/tui
bash scripts/check-tui-command-center.sh
```

The marketing site is static and has no package-local build command.
