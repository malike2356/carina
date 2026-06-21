# Gap 13; Truth in Advertising (Carina Identity and Surface Honesty)

**Status: COMPLETED 2026-06-21**

**What was built:** Full gap-13 truth in advertising: surface contract, channel quick replies, cloud identity, secret refusal guard, memory/tool honesty, cloud UI capability gating, writing style sanitizer, identity smoke + CI inventory check.

**Date:** 2026-06-19
**Status:** Prompts written. Implementation pending.
**Scope:** Every place Carina describes itself, lists capabilities, or answers "what can you do?" must match what that surface can actually do today.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Carina is a horizontal agent platform with many surfaces (CLI, TUI, web workspace, Telegram, Carina Cloud BYOK, mobile companion, marketing site, docs). Each surface can expose a different subset of tools, memory, and integrations. Today, several paths still answer capability questions with **the wrong catalog**:

| Symptom | Example | Root cause |
|---------|---------|------------|
| Web nav on Telegram | "Chat, Notes, Calendar, Trello..." when user is on `@CarinaVbot` | `orchestrator.quickReply()` calls `buildCapabilitySummaryLine()` from web shell nav |
| Property-only cloud identity | "AI assistant for property professionals" in Carina Cloud | `app.carinaai.uk/src/lib/carina-chat.ts` hardcoded BYOK prompt |
| Memory claimed without check | "Yes, persistent memory" even when memory backend is down | LLM follows system prompt; no runtime gate |
| Helpful refusals leak secrets | "I won't show .env but it contains OPENAI_API_KEY=..." | Prompt-only refusal; no output scanner for credential patterns |
| Marketing overshoot | carinaai.uk: "40+ channels, one persistent memory" | Static copy not tied to runtime capability contract |
| UI shows unavailable features | Sidebar links to Terminal, MCP, Cron when BYOK mode has no core proxy | Nav not gated on `getCloudCapabilities()` |

Users judge the whole product from the first three questions: **Who are you? What can you do? Do you remember me?** If any answer is wrong for the channel they are on, trust breaks even when the core agent is powerful.

**Note:** Scout marketing promises (labyrinthscout.com pricing features) are covered by **Gap 12** (Scout product) and the legacy audit in the previous version of this README. Gap 13 is **Carina agent identity and per-surface honesty only.**

---

## Gap Audit: Now vs Finished Product

| # | Gap | Current state | Finished product | Prompt |
|---|-----|---------------|------------------|--------|
| 1 | No single source of truth per surface | Web nav labels reused everywhere | `SurfaceCapabilityContract` per platform + channel | 01 |
| 2 | Channel-blind quick replies | Same capability list on Telegram, CLI, web | Channel-aware summaries from contract | 02 |
| 3 | Cloud chat wrong identity | Property-only BYOK prompt | Horizontal agent identity; cloud-scoped honesty | 03 |
| 4 | Secret refusal leaks | Model confirms file existence / contents | Mechanical output guard: "No." only | 04 |
| 5 | Memory/tool claims unchecked | LLM asserts memory/tools without runtime proof | Quick replies and prompts gated on live status | 05 |
| 6 | Cloud UI overpromises | Nav shows core-only pages in BYOK mode | Capability badges; hide or mark unavailable routes | 06 |
| 7 | Writing style gaps | `sanitizeCarinaProse` on gateway only | All outbound paths including cloud app + quick replies | 07 |
| 8 | Docs/marketing drift | capability-inventory.md manually maintained | CI guard + smoke tests per surface | 08 |

---

## Prompt Index

| # | Prompt | What It Builds | Effort | Agent |
|---|--------|----------------|--------|-------|
| 01 | Surface Capability Contract | Canonical `SurfaceCapabilityContract` module; per-platform/channel truth | 4-6 h | Claude Code |
| 02 | Channel-Aware Quick Replies | Fix orchestrator `quickReply()`; Telegram/CLI/web honest intros | 3-4 h | Claude Code |
| 03 | Cloud Chat Identity | Replace property-only prompt; core-proxy vs BYOK honest system prompt | 4-6 h | Claude Code |
| 04 | Secret Refusal Output Guard | Block credential leaks in refusals; enforce "No." only | 3-4 h | Claude Code |
| 05 | Memory and Tool Honesty | Runtime-gated answers for memory/capability questions | 3-4 h | Claude Code |
| 06 | Cloud UI Capability Badges | Sidebar/command palette gated on `getCloudCapabilities()` | 4-5 h | Cursor |
| 07 | Writing Style All Surfaces | `sanitizeCarinaProse` on cloud app, quick replies, error strings | 2-3 h | Claude Code |
| 08 | Capability Inventory CI Guard | Smoke tests + marketing/docs alignment check | 3-4 h | Claude Code |

**Total: 26-36 hours (~3-5 days with one agent, ~1-2 days with three parallel agents).**

---

## Build Order

```
Phase 1 (foundation):
  01-surface-capability-contract.md     Everything else imports this.

Phase 2 (user-visible fixes, parallel):
  02-channel-aware-quick-replies.md     Depends on 01
  03-cloud-chat-identity.md             Can start after 01; parallel with 02
  04-secret-refusal-output-guard.md     Standalone; can run in parallel

Phase 3 (honesty layer):
  05-memory-and-tool-honesty.md         Depends on 01
  06-cloud-ui-capability-badges.md      Depends on 01, 03
  07-writing-style-all-surfaces.md      Depends on 02 (quick reply path)

Phase 4 (regression prevention):
  08-capability-inventory-ci-guard.md   Depends on 01-07
```

---

## Done-When Criteria

After all 8 prompts:

- [ ] Telegram "what can you do?" lists Telegram-relevant abilities (search, memory, voice, tools if enabled), not web nav labels
- [ ] Carina Cloud chat system prompt matches horizontal agent identity; never "property professionals only" unless property-uk pack is active
- [ ] "Show me .env" always returns "No." with no file existence confirmation or key names
- [ ] "Do you have memory?" on any surface reflects actual memory backend status
- [ ] Cloud sidebar hides or badges routes that require core proxy when BYOK-only
- [ ] No em dashes or emojis in any Carina outbound text on gateway, cloud app, or quick replies
- [ ] `pnpm test` includes identity smoke tests for telegram, web, cli platforms
- [ ] `carina behavior-proof` or dedicated script fails if capability contract and docs inventory diverge

---

## Key Reference Files

```
core.carinaai.uk/src/product/feature-guide.ts          buildCapabilitySummaryLine (wrong for channels)
core.carinaai.uk/src/product/shell-config.ts           Web nav labels (hosted vs private)
core.carinaai.uk/src/agents/orchestrator.ts            quickReply bypasses LLM
core.carinaai.uk/src/agents/system-prompt.ts           Canonical core identity
app.carinaai.uk/src/lib/carina-chat.ts                 Cloud BYOK prompt (property-only bug)
app.carinaai.uk/src/lib/cloud-capabilities.ts          Partial honesty helper (extend in 03/06)
docs.carinaai.uk/docs/user/capability-inventory.md     Public capability inventory
carinaai.uk/index.html                                 Marketing claims to align in 08
```

---

## Relationship to Other Gaps

| Gap | Relationship |
|-----|--------------|
| Gap 12 (Scout product) | Scout marketing truth; separate product |
| Gap 09 prompt 11 (user modeling) | Complements memory honesty in 05 |
| Gap 05 security (behavior proof) | 08 extends behavior-proof for identity claims |
| Gap 06 web UI | 06 aligns cloud app nav with honest capabilities |
