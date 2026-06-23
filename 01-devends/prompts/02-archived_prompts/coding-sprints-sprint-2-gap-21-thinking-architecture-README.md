# Gap 21 - Thinking Architecture & Token Economics

**Status: COMPLETED 2026-06-21**

**What was built:**
- `src/agents/thinking-levels.ts` with tiered levels, provider mapping, `/think` and `/fast` gateway commands
- `src/agents/token-tracker.ts` with per-session usage, cost estimates, `/tokens` commands, spend alerts
- `src/agents/trajectory-recorder.ts` with tool-call bundles, `carina trajectory` CLI, router session cleanup
- `src/brain/thinking-request.ts` request-scoped thinking extras wired into LLM providers
- TUI status bar shows current thinking level

**Gap:** 21
**Sprint:** 2
**Source:** OpenClaw docs (thinking levels, tokenjuice, trajectory bundles)
**Goal:** Add tiered thinking control, per-session token tracking, and trajectory
  recording. Carina has basic thinking on/off but no graduated levels or spend
  visibility.

**Primary agent:** Claude Code
**Estimated hours:** 4-6 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Build Order

```
01-thinking-levels.md     Tiered thinking (off/min/low/med/high/xhigh/max/adaptive)
02-token-tracking.md      Per-session token counting, cost estimates, rate alerts
03-trajectory-bundles.md  Tool call trajectory recording for debugging/sharing
```
