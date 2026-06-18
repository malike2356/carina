# Gap 09 - Performance Parity with Hermes and OpenClaw

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date written:** 2026-06-18
**Source:** Deep research into Hermes (Nous Research) and OpenClaw source code
**Status:** 12 prompts - ready for implementation

---

## Why This Gap Exists

Carina's core response quality and session experience lag behind Hermes and OpenClaw despite
having comparable feature lists on paper. The root causes are architectural, not superficial:

1. **Cache misses every turn** - Carina rebuilds the system prompt when skills load, breaking
   Anthropic's prompt cache. Each turn pays full input token cost instead of 10% cached cost.

2. **One model for everything** - The same heavy primary model handles skill curation, title
   generation, embeddings, and session search. Hermes uses cheap auxiliary models for each.

3. **No cross-session recall** - Sessions are siloed. Hermes uses SQLite FTS5 for instant
   full-text search across all past conversations.

4. **No CLI theming** - Hermes operators can skin the terminal experience via YAML with zero
   code changes. Carina has web theming but the terminal is hard-coded.

5. **No voice wake** - OpenClaw ships wake word detection on macOS/iOS and continuous voice
   on Android. Carina has no voice capability.

6. **No failover** - A single 429 from Anthropic breaks Carina. OpenClaw rotates through
   auth profiles automatically.

7. **Unbounded delegation** - Without leaf role enforcement, Carina agents can recursively
   spawn children until token budget is exhausted.

8. **No IDE integration** - Hermes ACP adapter makes it a VS Code / Zed / JetBrains backend.
   Carina requires users to switch to a terminal.

---

## Prompts

| # | File | What It Fixes | Agent | Hours |
|---|------|--------------|-------|-------|
| 01 | `01-prompt-caching-invariant.md` | System prompt rebuilt every turn = full token cost | Claude Code | 3-4 |
| 02 | `02-auxiliary-model-routing.md` | Wrong model for sub-tasks = slow + expensive | Claude Code | 3-4 |
| 03 | `03-fts5-session-search.md` | No cross-session recall = agent forgets everything | Claude Code | 4-5 |
| 04 | `04-skin-theme-engine.md` | Hard-coded terminal colors = no operator branding | Claude Code | 3-4 |
| 05 | `05-cron-enhancements.md` | No script injection / context chaining / no-agent mode | Claude Code | 4-5 |
| 06 | `06-delegation-leaf-enforcement.md` | No spawn depth limits = recursive token explosion | Claude Code | 3-4 |
| 07 | `07-voice-wake.md` | No voice wake = must touch phone/computer | Codex + Cursor | 5-6 |
| 08 | `08-model-failover.md` | Single 429 = down | Claude Code | 3-4 |
| 09 | `09-supply-chain-pinning.md` | Unbounded deps = litellm-style attack surface | Codex | 2-3 |
| 10 | `10-dashboard-pty-bridge.md` | Fake web TUI diverges from terminal TUI | Claude Code | 4-5 |
| 11 | `11-honcho-user-modeling.md` | Agent doesn't know who the user is | Claude Code | 4-5 |
| 12 | `12-acp-ide-adapter.md` | No IDE integration = context switching friction | Claude Code | 4-5 |

**Total: 43-54 hours. With 3 parallel agents: 3-4 additional days.**

---

## Execution Order for This Gap

All 3 agents can start in parallel. These do NOT depend on each other unless noted:

```
Day 1 (all 3 agents):
  Agent A (Claude Code): 01-prompt-caching-invariant + 02-auxiliary-model-routing
  Agent B (Claude Code): 03-fts5-session-search + 05-cron-enhancements
  Agent C (Codex):       09-supply-chain-pinning + partial 07-voice-wake (hooks)

Day 2:
  Agent A (Claude Code): 06-delegation-leaf-enforcement + 08-model-failover
  Agent B (Claude Code): 11-honcho-user-modeling (depends on 02 for auxiliary model)
  Agent C (Cursor):      07-voice-wake screens (depends on Agent C day 1 hooks)

Day 3:
  Agent A (Claude Code): 04-skin-theme-engine + 10-dashboard-pty-bridge
  Agent B (Claude Code): 12-acp-ide-adapter
  Agent C:               Testing and integration
```

---

## Priority If Time Is Tight

If you can only do some of these, prioritize in this order:

1. `01` - Biggest immediate performance win. Every conversation benefits.
2. `02` - Significant cost and speed win for background tasks.
3. `08` - Critical for reliability in production (cron, mobile, always-on).
4. `03` - Dramatically improves agent memory and recall.
5. `06` - Prevents runaway agent costs in multi-agent scenarios.
6. `09` - Security hygiene, low effort.
7. `11` - User experience lift that compounds over time.
8. `04` - Operator/white-label value.
9. `05` - Power user cron features.
10. `10` - Nice to have for operators without terminal access.
11. `07` - Mobile-specific, significant effort.
12. `12` - Developer-focused, separate package.

---

## What Was Already in Carina (NOT re-implemented here)

After checking the codebase, these Hermes/OpenClaw features ALREADY EXIST in Carina:

- Skill Curator (`src/skills/curator.ts`) - exists, 80%+ feature-complete
- Kanban multi-agent queue (`src/agents/kanban-service.ts`) - exists
- Profiles / multi-instance isolation (`src/profiles/`) - exists
- DM pairing security (`src/gateway/channels/dm-pairing.ts`) - exists
- 103 channel adapters including LINE, Matrix, WeChat, Zalo, Mattermost - exists
- SQLite backend (`src/memory/backends/sqlite-backend.ts`) - exists
- Orchestrator (`src/agents/orchestrator.ts`) - exists (but no role enforcement - see 06)