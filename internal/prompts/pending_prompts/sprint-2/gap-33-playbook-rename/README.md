# Gap 33: Cookbook to Playbook Terminology Migration

**Date:** 2026-06-22
**Status:** PROMPTS WRITTEN - Ready for implementation
**Total Prompts:** 1
**Estimated Days:** 0.5-1
**Primary agent:** Claude Code or Codex

This gap replaces user-facing "cookbook" language with "playbook" across Carina, Scout,
and security-facing material. Keep internal implementation names such as `src/cookbook/`
unless a separate code migration prompt explicitly renames them.

---

## Post-build (MANDATORY)

When the prompt in this gap is done:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of the prompt file.
2. Add a short `What was built:` list.
3. Move the prompt file from `pending_prompts/` to `archived_prompts/pending_prompts/`
   keeping the same relative path. Use `git mv` when possible.
4. If the gap is fully complete, move this README the same way and keep the relative path.
5. Do not leave completed prompts in `pending_prompts/`.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Prompt Inventory

| # | File | Focus | Agent |
|---|------|-------|-------|
| 01 | `01-cookbook-to-playbook-migration.md` | Replace user-facing cookbook terminology with playbook terminology | Claude Code |

---

## Execution Order

Run prompt 01 first. It is the only prompt in this gap.

