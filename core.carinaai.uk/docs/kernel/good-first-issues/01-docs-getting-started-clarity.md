---
title: "docs: clarify kernel vs Scout in getting started guide"
labels:
  - good first issue
  - documentation
---

## Context

New contributors and self-hosters should understand that **Carina core is free and MIT licensed**, while **Labyrinth Scout is an optional commercial security layer**. The getting started guide mentions Scout in a few places but does not consistently frame the kernel vs security boundary.

Brand rules: `core.carinaai.uk/docs/kernel/BRAND_RULES.md` (monorepo) or the [pricing boundary](https://carinaai.uk/docs/user/pricing) doc.

## Task

Update the getting started guide so Scout is always described as optional and commercial, not bundled with MIT self-host installs.

## Files to touch

- `docs.carinaai.uk/docs/user/getting-started.md` (canonical Docusaurus source in the monorepo)
- Optionally add a one-line cross-link from `docs.carinaai.uk/docs/user/intro.md` if helpful

## Suggested changes

1. Add a short **"Kernel vs Scout"** subsection after "Carina Cloud (no install)" explaining:
   - Carina agent (`npm install -g carina-agent`) is free forever
   - Scout is optional; paid plans at labyrinthscout.com
   - `LABYRINTH_ENABLED=false` means zero Scout integration
2. Review the Redis bullet ("Scout kill-switch channel") and clarify it applies only when Scout is paired
3. Do not remove Carina Cloud Pro Scout references; clarify those are paid hosted plans, not MIT core

## Acceptance criteria

- [ ] Getting started doc states Scout is optional and commercial
- [ ] No wording implies Scout ships free with MIT `carina-agent`
- [ ] Links to [pricing boundary](https://carinaai.uk/docs/user/pricing) and [Labyrinth Scout](https://carinaai.uk/docs/user/security/labyrinth-scout)
- [ ] No emojis or em-dashes in changed prose

## Test

```bash
cd docs.carinaai.uk && pnpm build
grep -i "optional\|commercial" docs/user/getting-started.md
```
