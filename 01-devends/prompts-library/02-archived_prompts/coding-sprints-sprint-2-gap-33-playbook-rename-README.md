# Gap 33: Cookbook to Playbook Terminology Migration

**Status: COMPLETED 2026-06-23**

**Date:** 2026-06-22
**Total Prompts:** 1
**Primary agent:** Claude Code or Codex

**What was built:**
- User-facing Playbook terminology in core web assets (`playbook.html`, `cookbook.html` redirect)
- `carina playbook` CLI primary command; `carina cookbook` deprecated alias with notice
- `AGENTS.md`, `REUSE-RULES.md`, `PRODUCT_BIBLE.md` glossary updates
- `scripts/verify-playbook-rename.sh` + `src/cli/playbook-rename.test.ts`

This gap replaces user-facing "cookbook" language with "playbook" across Carina, Scout,
and security-facing material. Internal implementation names such as `src/cookbook/` remain.

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

