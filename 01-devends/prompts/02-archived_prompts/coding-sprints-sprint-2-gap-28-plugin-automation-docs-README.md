**Status: COMPLETED 2026-06-23 (re-verified)**

**What was built:**
- `docs/developer/plugins/overview.md`, `docs/developer/plugins/building-plugins.md`
- `docs/developer/automation/scheduled-tasks.md`, `docs/developer/automation/hooks.md`
- Plugins and Automation categories in `sidebars.ts`
- `pnpm build` passes (verified 2026-06-23)


# Gap 28 - Documentation: Plugin System & Automation

**Gap:** 28
**Sprint:** 2
**Type:** Documentation
**Source:** OpenClaw docs (Plugins, Building plugins, Plugin hooks, Automation, Scheduled tasks, Background tasks)
**Target dir:** `marketing/docs/docs.carinaai.uk/docs/developer/`

**Goal:** Write documentation for Carina's plugin system and automation features.
  Carina has plugin infrastructure (registry, loader, hooks) and automation
  (cron, scheduled tasks, taskflows) but these are entirely undocumented.

**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 3-4 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Pages to write

### Plugin System (2 pages)
1. `docs/developer/plugins/overview.md` -- plugin architecture, registry, loading
2. `docs/developer/plugins/building-plugins.md` -- how to build a Carina plugin

### Automation (2 pages)
3. `docs/developer/automation/scheduled-tasks.md` -- cron, scheduled tasks, taskflows
4. `docs/developer/automation/hooks.md` -- lifecycle hooks reference

---

## Build Order

```
01-plugin-system.md        Plugin overview + building plugins
02-automation.md           Cron, scheduled tasks, hooks
```

---

## Done When
- [x] 4 new pages written
- [x] Each page references real source files
- [x] Sidebar updated with "Plugins" and "Automation" categories
- [x] `pnpm build` passes
