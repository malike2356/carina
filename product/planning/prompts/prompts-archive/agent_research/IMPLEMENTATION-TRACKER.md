# Agent Research Implementation Tracker

**Last audited:** 2026-06-16 (post channel-stubs + context/security overlays)  
**Codebase:** `carina/core.carinaai.uk/` (+ Scout surfaces under `carina/console.labyrinthscout.com`, `carina/labyrinthscout.com`)  
**Related prompt pack:** `instructions/prompts/researched_gap/prompts/` (01-20)

Use this file to track research-doc recommendations against shipped code. Update the **Status** column as work lands.

---

## Recently shipped (confirmed in code)

| IDs | Item | Code | Test |
|-----|------|------|------|
| COF-03, CAL-09 | `CARINA_CROSS_AGENT=false` skips cross-agent context sync | `src/agents/carina.ts` | carina integration |
| COF-04 | Model-window token budget (70% cap) | `src/memory/context-budget.ts` | `context-budget.test.ts` |
| CH-S01..S20 | All catalog channel stubs live | `src/gateway/channels/adapters/catalog-stub-adapters.ts` | 221 channel tests |
| CAA-19, DGR-S07 | Plan-mode tool allowlist (non-admin) | `src/security/admin-tool-policy.ts`, `tool-runner.ts` | `security-guardrails.test.ts` |
| KPB-13, ASP-11 | Provider-family prompt overlays | `src/brain/prompt-overlays.ts` | `prompt-overlays.test.ts` |
| DGR-O01 | OpenTelemetry trace export | `src/telemetry/otel.ts`, `trace.ts`, `index.ts` | `otel.test.ts` |
| DGR-O02..O05 | Session/subagent, prompt cache, channels, telemetry UI | see Observability table | observability tests |
| CAL-06..11 | Workspace personality, heartbeat, hub sync, REM dreaming | see CROSS-AGENT-LEARNING table | identity/check-in/hub/rem tests |

---

## Remaining for Cursor

### P0: Scout product independence (commercial blocker)

Real blocker set: **SCI-02, SCI-03, SCI-04, SCI-05, SCI-06, SCI-07, SCI-08, SCI-09, SCI-10, SCI-11, SCI-12, SCI-14**

| ID | Item | Status | Notes |
|----|------|--------|-------|
| SCI-01 | Scout-native signup/login | partial | Console shell exists; needs Scout-owned auth flow (not Carina session) |
| SCI-02 | Checkout on Scout Stripe | missing | Still routes to `core.carinaai.uk/checkout?plan=scout_*` |
| SCI-03 | Scout billing portal | missing | Carina Stripe account / records |
| SCI-04 | Scout-native provisioning webhook | partial | `scout-provisioning.ts` tied to Carina billing |
| SCI-05 | First-class Scout console | partial | `console.labyrinthscout.com`; Carina proxy deps remain |
| SCI-06 | Canonical docs at labyrinthscout.com | partial | Carina cross-links remain |
| SCI-07 | Trust dashboard on Scout domain | missing | `carinaai.uk/trust` referenced |
| SCI-08 | Scout-only marketing/footer/branding | missing | `carina-pulse` CSS, Carina checkout CTAs |
| SCI-09 | Scout API keys without Carina session | partial | API key model exists; auth still coupled |
| SCI-10 | Separate Scout database / tenant isolation | partial | Console migrations; shared infra possible |
| SCI-11 | Standalone deploy unit (`verlox/scout`) | partial | Console deploy separate; billing on Carina |
| SCI-12 | npm `@labyrinthscout/core` | missing | Installable SDK without Carina |
| SCI-13 | Carina integrates via API only | done | `LABYRINTH_ENABLED`, `SCOUT_API_KEY` |
| SCI-14 | Self-serve under 30 minutes | missing | Blocked by Carina checkout path |

**Tight Cursor order:** SCI-02..08 first, then SCI-09..12 and SCI-14, then SCI-01 auth hardening.

Key files: `labyrinthscout.com/index.html`, `console.labyrinthscout.com/public/**/*.html`, `console.labyrinthscout.com/src/api/account.ts`

### P1: Observability

| IDs | Item | Status |
|-----|------|--------|
| DGR-O01 | OpenTelemetry export | done |
| DGR-O02 | Session/subagent telemetry | done |
| DGR-O03 | Prompt cache observability | done |
| DGR-O04 | Channel health monitor | done |
| DGR-O05 | Usage metrics UI | done |

### P2: Prompt and personality parity (done)

| IDs | Item | Status |
|-----|------|--------|
| KPB-06, KPB-07 | IDENTITY + SOUL prose | done |
| ASP-07, ASP-08, ASP-12, ASP-13, ASP-14 | Bootstrap tiers, identity parity, volatile tier, file-based injection | done |
| CAL-06, CAL-07, CAL-10, CAL-11 | Workspace personality, social intelligence, hub sync, memory dreaming | done |
| CAA-08, CAA-12, CAA-13, CAA-20, CAA-22 | SOUL/IDENTITY depth, memory dreaming, push wake, UI anchors, embedding tool select | done |

### P3: Security, streaming, cost, skills, surfaces

| Area | IDs | Status |
|------|-----|--------|
| Security | DGR-S01, DGR-S03, DGR-S04, DGR-S05, DGR-S06, DGR-S09 | done / partial |
| Streaming | DGR-ST03, DGR-ST04 | done |
| Cost/model | DGR-C05, DGR-C06 | done |
| Skills | DGR-SK02, DGR-SK03, DGR-SK04 | partial |
| Setup/surfaces | DGR-D04..06, HOC-06, UCG-03..11 | partial |

**Suggested Cursor sequence after Scout P0:** CAL-06..12 and UCG-03..11 partials, then DGR-O02..O05 observability depth.

---

## Legend

| Status | Meaning |
|--------|---------|
| `done` | Implemented and wired; tests or manual verification exist |
| `partial` | Core exists; gaps remain vs the research doc |
| `missing` | Not implemented |
| `ops` | Operational/config only; no code change required |

## Summary (2026-06-16)

| Source doc | Done | Partial | Missing | Ops |
|------------|------|---------|---------|-----|
| KARINA-PROMPT-BLOCKS.md | 10 | 2 | 0 | 0 |
| AGENT-SYSTEM-PROMPTS.md | 9 | 4 | 1 | 0 |
| CROSS-AGENT-LEARNING.md | 8 | 3 | 1 | 0 |
| CONTEXT-OVERFLOW-FIX.md | 4 | 0 | 0 | 2 |
| HARDCODED-PARAMETRICS.md | 14 | 1 | 0 | 0 |
| CROSS-AGENT-ARCHITECTURE.md | 15 | 5 | 2 | 0 |
| DEEP-GAPS-REPORT.md | 18 | 12 | 8 | 0 |
| CHANNEL-STUBS.md | 20 | 0 | 0 | 0 |
| hermes_oddyseus_to_carina.md | 6 | 2 | 0 | 0 |
| UI-CLI-GUI-REPORT.md | 6 | 5 | 4 | 0 |
| SCOUT-INDEPENDENCE.md | 1 | 2 | 11 | 0 |

**Overall:** Core agent behavior, channel adapters, context budget, plan-mode security, provider overlays, and OpenTelemetry export are shipped. Remaining work is dominated by **Scout SaaS independence (SCI-02..14)**, then prompt/personality parity and UI/surface partials.

---

## KARINA-PROMPT-BLOCKS.md

Maps to prompt pack **01-05**. Injection spec for system prompt blocks.

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| KPB-01 | Tool-use enforcement block | done | `src/agents/system-prompt.ts` (`buildExecutionDisciplineBlock`) | `src/agents/system-prompt.test.ts` |
| KPB-02 | Anti-fabrication / finishing-the-job block | done | `src/agents/system-prompt.ts` | `src/agents/system-prompt.test.ts` |
| KPB-03 | Three-turn-end model (DONE/BLOCKED/KEEP GOING) | done | `src/agents/turn-discipline.ts` | `src/agents/turn-discipline.test.ts` |
| KPB-04 | Bias toward action | done | `src/agents/turn-discipline.ts` | `src/agents/turn-discipline.test.ts` |
| KPB-05 | Fail-silent prevention | done | `src/agents/turn-discipline.ts` | `src/agents/turn-discipline.test.ts` |
| KPB-06 | IDENTITY block (Laud placeholder) | done | `src/agents/identity-defaults.ts` (`buildOpenClawIdentityScaffold`, Hermes fallback); workspace `IDENTITY.md` via `src/workspace/context-files.ts` | `identity-defaults.test.ts` |
| KPB-07 | SOUL / personality philosophy | done | `buildOpenClawSoulFallback()` in `identity-defaults.ts`; workspace `SOUL.md` override | `identity-defaults.test.ts` |
| KPB-08 | Casual message handling | done | `src/agents/conversation-discipline.ts` | `src/agents/conversation-discipline.test.ts` |
| KPB-09 | Mandatory tool list | done | `src/agents/mandatory-tools.ts` | via system-prompt tests |
| KPB-10 | Memory discipline | done | `src/memory/memory-discipline.ts` | `src/memory/memory-discipline.test.ts` |
| KPB-11 | Execution checklist (volatile tier) | done | `buildVolatileExecutionChecklist()` in `system-prompt.ts`; wired volatile tier in `carina.ts` | `system-prompt.test.ts` |
| KPB-12 | Domain rule packs (conditional injection) | done | `src/domain-rules/` | `src/domain-rules/select.test.ts` |
| KPB-13 | Provider overlays (built-in families + `~/.carina/overlays/`) | done | `src/brain/prompt-overlays.ts`, wired in `carina.ts` | `prompt-overlays.test.ts` |
| KPB-14 | Subagent context minimization | done | `src/agents/subagent-prompt.ts`; `loadWorkspaceContext(..., { mode: 'minimal' })` in `carina.ts` | `subagent-prompt.test.ts` |

---

## AGENT-SYSTEM-PROMPTS.md

Cross-agent system prompt comparison; overlaps KARINA-PROMPT-BLOCKS.

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| ASP-01 | Hermes tool-use enforcement adopted | done | `system-prompt.ts` | `system-prompt.test.ts` |
| ASP-02 | Hermes anti-fabrication adopted | done | `system-prompt.ts` | `system-prompt.test.ts` |
| ASP-03 | Odysseus three-turn model adopted | done | `turn-discipline.ts` | `turn-discipline.test.ts` |
| ASP-04 | Odysseus casual handling adopted | done | `conversation-discipline.ts` | `conversation-discipline.test.ts` |
| ASP-05 | Hermes mandatory tools adopted | done | `mandatory-tools.ts` | via system-prompt tests |
| ASP-06 | Hermes memory discipline adopted | done | `memory-discipline.ts` | `memory-discipline.test.ts` |
| ASP-07 | OpenClaw SOUL.md + IDENTITY.md bootstrap | done | `src/workspace/context-files.ts`, `identity-defaults.ts` (`buildOpenClawSoulFallback`, scaffold) | `identity-defaults.test.ts`, workspace bootstrap tests |
| ASP-08 | Three-tier prompt assembly (stable/context/volatile) | done | `prompt-tiers.ts`, `buildSystemPromptTierParts()`, volatile tier in `carina.ts` | `prompt-tiers.test.ts`, `system-prompt.test.ts` |
| ASP-09 | Context compaction with REFERENCE ONLY prefix | done | `src/memory/memory-discipline.ts` (`COMPACTION_REFERENCE_PREFIX`) | `memory-discipline.test.ts` |
| ASP-10 | Bootstrap files (AGENTS, SOUL, TOOLS, IDENTITY, USER, MEMORY) | done | `src/workspace/context-files.ts` | workspace tests |
| ASP-11 | Provider-family overlays | done | `src/brain/prompt-overlays.ts` | `prompt-overlays.test.ts` |
| ASP-12 | Full Hermes DEFAULT_AGENT_IDENTITY verbatim parity | done | `buildHermesDefaultAgentIdentity()` in `identity-defaults.ts` | `identity-defaults.test.ts` |
| ASP-13 | Volatile execution checklist as separate injected tier | done | `buildVolatileExecutionChecklist()`; volatile tier in `carina.ts` | `system-prompt.test.ts` |
| ASP-14 | File-based `~/.carina/system/*.md` injection | done | `system-prompt-files.ts` (`~/.carina/system/` + legacy `~/.karina/system/`) | `system-prompt-files.test.ts` |

---

## CROSS-AGENT-LEARNING.md

Personality, memory, and cross-install skill sharing.

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| CAL-01 | Tool-use + anti-fabrication in prompt | done | `system-prompt.ts` | `system-prompt.test.ts` |
| CAL-02 | Turn discipline (three-turn + fail-silent) | done | `turn-discipline.ts` | `turn-discipline.test.ts` |
| CAL-03 | Memory discipline (declarative facts, no stale artifacts) | done | `memory-discipline.ts` | `memory-discipline.test.ts` |
| CAL-04 | Cross-agent skill learning loop | done | `src/skills/learning-loop.ts`, `src/sync/cross-agent-learning.ts` | learning-loop tests |
| CAL-05 | Toggle cross-agent skill promotion | done | `CARINA_CROSS_AGENT_LEARNING` env | `learning-loop.ts` |
| CAL-06 | Workspace SOUL/IDENTITY personality | done | `identity-defaults.ts`, `context-files.ts`, workspace bootstrap in router | `identity-defaults.test.ts`, `context-files.test.ts` |
| CAL-07 | OpenClaw proactive/social intelligence (heartbeat, group norms) | done | `check-in.ts`, `heartbeat-state.ts`, `group-chat.ts`, `conversation-discipline.ts` | `check-in.test.ts`, `group-chat.test.ts` |
| CAL-08 | Cross-agent context sync (OpenClaw noise) | done | `src/sync/agent-sync.ts` (`loadCrossAgentContext`) | agent-sync tests |
| CAL-09 | Disable cross-agent context sync | done | `CARINA_CROSS_AGENT=false` in `carina.ts` | carina integration |
| CAL-10 | Hub skills sync / shared skill corpus | done | `hub-sync-scheduler.ts`, `cross-agent-hub-sync.ts`, `carina learning sync` | `hub-sync-scheduler.test.ts`, `cross-agent-hub-sync.test.ts` |
| CAL-11 | Memory dreaming / nightly consolidation | done | `rem-promotion.ts`, `dreams.ts`, `rem-scheduler.ts`, `carina memory dreams/promote` | `rem-scheduler.test.ts`, `dreams.test.ts` |
| CAL-12 | Provider overlays per model family | done | `src/brain/prompt-overlays.ts` | `prompt-overlays.test.ts` |

---

## CONTEXT-OVERFLOW-FIX.md

Operational fix for DeepSeek context overflow (double replies, hallucinated tools).

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| COF-01 | `CARINA_MAX_MEMORY_CONTEXT` env override | done | `src/config/index.ts` | config tests |
| COF-02 | Context char budget trimming | done | `src/memory/context-budget.ts` (`applyContextBudget`) | `context-budget.test.ts` |
| COF-03 | `CARINA_CROSS_AGENT=false` to skip sync context | done | `carina.ts` (`crossAgentEnabled` gate) | carina integration |
| COF-04 | Token budget guard at 70% of model window | done | `context-budget.ts` (`modelWindowTokens`, 70% cap) | `context-budget.test.ts` |
| COF-05 | Switch to Claude (`DEFAULT_PROVIDER=anthropic`) | ops | `src/brain/llm.ts`, provider registry | manual |
| COF-06 | Weekly `/clear` hygiene | ops | Session clear via CLI/API | manual |
| COF-07 | Wired into agent turn assembly | done | `carina.ts` uses `maxMemoryContext` + `applyContextBudget` | carina integration |

---

## HARDCODED-PARAMETRICS.md

All 14 "must fix" items from the audit.

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| HP-01 | `CARINA_SESSION_TIMEOUT_MS` | done | `src/config/index.ts` | - |
| HP-02 | `CARINA_MAX_MEMORY_CONTEXT` | done | `src/config/index.ts` | - |
| HP-03 | `CARINA_MAX_TURNS` | done | `src/config/index.ts`, `runtime-config.ts` | `runtime-config.test.ts` |
| HP-04 | `CARINA_SUBAGENT_MAX_TURNS` | done | `src/config/index.ts` | - |
| HP-05 | `CARINA_TASKFLOW_MAX_TURNS` | done | `src/config/index.ts` | - |
| HP-06 | `LABYRINTH_JUDGE_TIMEOUT_MS` | done | `src/config/index.ts` | - |
| HP-07 | `GEMINI_EMBEDDING_MODEL` | done | `src/config/index.ts` | `embeddings.test.ts` |
| HP-08 | `OPENAI_EMBEDDING_MODEL` | done | `src/config/index.ts` | `embeddings.test.ts` |
| HP-09 | `CARINA_EMBEDDING_DIMENSIONS` | done | `src/config/index.ts` | `embeddings.test.ts` |
| HP-10 | `CARINA_EMBEDDING_MAX_CHARS` / voyage max | done | `src/config/index.ts`, `embeddings.ts` | `embeddings.test.ts` |
| HP-11 | LLM ultimate fallback (no hardcoded deepseek) | done | `src/brain/llm.ts` (`FREE_COPILOT_PRESET` chain) | llm tests |
| HP-12 | `TRELLO_BASE_URL` | done | `src/config/index.ts`, `src/tools/trello.ts` | trello tests |
| HP-13 | `BRAVE_SEARCH_URL` / `TAVILY_SEARCH_URL` | done | `src/config/index.ts`, `web-search-provider.ts` | `web-search-provider.test.ts` |
| HP-14 | Voyage embeddings URL via provider registry | done | `embeddings.ts` (`voyageEmbeddingsUrl()`) | `embeddings.test.ts` |
| HP-15 | `defaultProvider` empty string when unset (not deepseek) | partial | `config/index.ts` may still cast provider type; runtime resolves in `llm.ts` | llm tests |

---

## CROSS-AGENT-ARCHITECTURE.md

Section 10 "What Karina Should Adopt" + Section 11 implementation priorities.

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| CAA-01 | Tool-use enforcement (Hermes) | done | `system-prompt.ts` | prompt 01 |
| CAA-02 | Anti-fabrication (Hermes) | done | `system-prompt.ts` | prompt 01 |
| CAA-03 | Context compaction warning prefix (Hermes) | done | `memory-discipline.ts` | prompt 02 |
| CAA-04 | Subagent architecture (Hermes) | done | `sub-agent.ts`, `generic-sub-agent.ts`, `subagent-prompt.ts` | prompt 08 |
| CAA-05 | Memory discipline (Hermes) | done | `memory-discipline.ts` | prompt 02 |
| CAA-06 | Mandatory tool list (Hermes) | done | `mandatory-tools.ts` | prompt 07 |
| CAA-07 | Registry-based tool discovery | done | `src/tools/registry.ts` | tool registry tests |
| CAA-08 | SOUL.md + IDENTITY.md (OpenClaw) | done | `context-files.ts`, `identity-defaults.ts` | `identity-defaults.test.ts`, prompt 05 |
| CAA-09 | Plugin SDK (OpenClaw) | done | `src/plugin-sdk/`, `src/public-api/plugin-sdk.ts` | prompt 10 |
| CAA-10 | Retry infrastructure (OpenClaw) | done | `src/infrastructure/retry.ts` | prompt 06 |
| CAA-11 | Bootstrap file system (OpenClaw) | done | `src/workspace/context-files.ts` | prompt 05 |
| CAA-12 | Memory dreaming (OpenClaw) | done | `rem-promotion.ts`, `dreams.ts`, `rem-scheduler.ts`, DREAMS.md in bootstrap + prompt | `rem-scheduler.test.ts`, `dreams.test.ts` |
| CAA-13 | Push-based completion wake for subagents | done | `subagent-push-wake.ts`, `delegation-completion.ts`, wired in `index.ts` | `subagent-push-wake.test.ts` |
| CAA-14 | PromptMode minimal for subagents (OpenClaw) | done | `subagent-prompt.ts`, minimal bootstrap in `carina.ts` | `subagent-prompt.test.ts` |
| CAA-15 | Three-turn-end model (Odysseus) | done | `turn-discipline.ts` | prompt 03 |
| CAA-16 | Bias toward action (Odysseus) | done | `turn-discipline.ts` | prompt 03 |
| CAA-17 | Fail-silent prevention (Odysseus) | done | `turn-discipline.ts` | prompt 03 |
| CAA-18 | Casual message handling (Odysseus) | done | `conversation-discipline.ts` | prompt 04 |
| CAA-19 | Tool security model + plan mode allowlist (Odysseus) | done | `admin-tool-policy.ts`, `tool-runner.ts` | `security-guardrails.test.ts` |
| CAA-20 | UI anchors (`[Name](#session-id)`) | done | `src/ui/session-anchors.ts`, web `bindSessionAnchorLinks` in `index.html` | `session-anchors.test.ts` |
| CAA-21 | Domain rule packs (Odysseus) | done | `src/domain-rules/` | prompt 10 |
| CAA-22 | Embedding-based tool selection for small models | done | `tool-embedding-select.ts`, wired in `session-tool-resolution.ts` + `carina.ts` | `tool-embedding-select.test.ts` |

### Phase priorities (Section 11)

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 (prompt blocks 1-6) | Behavioral fixes | **done** (prompts 01-05) |
| Phase 2 (IDENTITY + SOUL) | Personality | **done** |
| Phase 3 (retry, compaction, bootstrap) | Infrastructure | **done** (prompts 02, 05, 06) |
| Phase 4 (subagents) | Delegation | **done** (prompt 08) |
| Phase 5 (plugin SDK, domain packs, dreaming, embedding tool select) | Platform | **done** |

---

## DEEP-GAPS-REPORT.md

High-level parity vs Hermes, OpenClaw, Odysseus. Report dated pre prompt-pack; many "zero gap" claims are now stale.

### Safety and security

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-S01 | URL/path safety | done | `evaluateUrlSafety()` in `http.ts`, path guards | `security-guardrails.test.ts` |
| DGR-S02 | Prompt guard / injection detection | done | `src/security/prompt-guard.ts`, middleware | `prompt-guard.test.ts` |
| DGR-S03 | Output redaction | done | `prompt-guard-middleware.ts`, redaction modules | security tests |
| DGR-S04 | Security doctor / audit CLI | done | `security-doctor.ts`, `security-cli.ts` doctor/advisories | `security-advisories.test.ts` |
| DGR-S05 | Interactive approval system (Hermes-level) | done | `channel-approval-ui.ts` (default on), confirm gates | channel tests |
| DGR-S06 | Exec approval levels (OpenClaw) | done | `exec-approval-levels.ts`, `approval-policy.ts` | `exec-approval-levels.test.ts` |
| DGR-S07 | Odysseus plan-mode allowlist | done | `admin-tool-policy.ts` | `security-guardrails.test.ts` |
| DGR-S08 | Rate limiting | done | Auth rate limits, inbound guards | gateway tests |
| DGR-S09 | Security advisories feed | done | `security-advisories.ts`, `carina security advisories` | `security-advisories.test.ts` |

### Streaming

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-ST01 | SSE streaming | done | Gateway stream pipeline, research SSE | stream tests |
| DGR-ST02 | Token-level streaming | done | LLM streaming adapters | provider tests |
| DGR-ST03 | Block streaming (OpenClaw) | done | `block-stream-assembler.ts`, Telegram wiring | `block-stream-assembler.test.ts` |
| DGR-ST04 | Stream draft controls | done | `stream-draft-controls.ts`, pause/resume/discard API | `stream-draft-controls.test.ts` |

### Observability

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-O01 | OpenTelemetry | done | `src/telemetry/otel.ts`, wired in `trace.ts`, `index.ts`, `health-snapshot.ts` | `otel.test.ts` |
| DGR-O02 | Session/subagent telemetry | done | `session-telemetry.ts`, `/api/ops/telemetry/sessions`, health snapshot | `session-telemetry.test.ts` |
| DGR-O03 | Prompt cache observability | done | `prompt-cache-observability.ts`, `/api/ops/telemetry/prompt-cache` | `prompt-cache-observability.test.ts` |
| DGR-O04 | Channel health monitor | done | `channel-health.ts`, `/api/ops/telemetry/channels` | `channel-health.test.ts` |
| DGR-O05 | Usage metrics UI | done | `ops/telemetry.html`, `/api/carina-ops/telemetry/*`, metrics API | `observability-routes.test.ts` |

### i18n

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-I01 | Backend i18n (`t()`, locales) | done | `src/i18n/`, `locales/en.json`, `locales/es.json` | i18n tests |
| DGR-I02 | Web UI 10-20 languages | partial | 2 locales; not Hermes/OpenClaw scale | - |
| DGR-I03 | Locale API + CLI | done | `src/api/locale-api.ts`, `carina locale` | locale-api tests |

### Cost and budget

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-C01 | Iteration budget (Hermes) | done | `src/agents/iteration-budget.ts` | `iteration-budget.test.ts` |
| DGR-C02 | Model cost guard | done | `src/brain/cost-guards.ts` | cost-guards tests |
| DGR-C03 | Spend/cost tracking | done | `src/brain/cost-tracker.ts` | cost tests |
| DGR-C04 | Runtime YAML budget config | done | `src/config/runtime-config.ts` | `runtime-config.test.ts` |
| DGR-C05 | Provider API quota polling | done | `provider-quota-poller.ts`, LLM header capture, scheduled task | observability routes |
| DGR-C06 | Token counting | done | `token-counter.ts`, `mergeTokenUsage()` in carina | `token-counter.test.ts` |

### Skills

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-SK01 | Skills system + hub | done | `src/skills/`, hub sync | prompt 12 |
| DGR-SK02 | Skill workshop (agent creates skills) | partial | `workshop-store.ts`, `/api/workshop/*` | manual |
| DGR-SK03 | ClawHub-scale marketplace | partial | `marketplace-catalog.ts`, `/api/marketplace/*`, `marketplace.html` | manual |
| DGR-SK04 | Skill security scanning | done | `skill-security.ts`, workshop draft scans | plugin-sdk tests |

### Deep research and teacher

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-R01 | Deep research multi-step | done | `src/agents/deep-research.ts` | deep-research tests |
| DGR-R02 | Research quality gate | done | `research-quality-gate.ts` | quality-gate tests |
| DGR-R03 | Teacher escalation on turn failure | done | `teacher-escalation.ts` | teacher tests |
| DGR-R04 | Structured research SSE progress | done | `research-progress.ts`, research API | research tests |

### Setup, Docker, surfaces

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| DGR-D01 | Docker standalone compose | done | `docker-compose.standalone.yml`, entrypoint | setup tests |
| DGR-D02 | Workspace seed / first-run | done | `src/setup/` | setup tests |
| DGR-D03 | TUI surface | done | `src/tui/` | surfaces tests |
| DGR-D04 | Mobile companion web | partial | `mobile.html`, service-worker shells | surfaces tests |
| DGR-D05 | Native desktop app | partial | `native/desktop/README.md` scaffold | manual |
| DGR-D06 | Native Android/iOS | partial | `native/mobile/README.md` scaffold | manual |

---

## CHANNEL-STUBS.md

Catalog vs adapter reality as of audit date 2026-06-15.

### Live channels (doc: 16 + 3 push + 2 meta = 21)

| ID | Channel | Status | Adapter | Notes |
|----|---------|--------|---------|-------|
| CH-L01 | telegram | done | `telegram-adapter.ts` | Live |
| CH-L02 | whatsapp | done | `whatsapp-adapter.ts` | Live |
| CH-L03 | discord | done | `discord-adapter.ts` | Live |
| CH-L04 | sms | done | `sms-adapter.ts` | Live |
| CH-L05 | web | done | `web-adapter.ts` | Live |
| CH-L06 | slack | done | `slack-adapter.ts` | Live |
| CH-L07 | signal | done | `signal-adapter.ts` | Live |
| CH-L08 | matrix | done | `matrix-adapter.ts` | Live |
| CH-L09 | rocketchat | done | `rocketchat-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L10 | kakaotalk | done | `kakaotalk-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L11 | threema | done | `threema-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L12 | keybase | done | `keybase-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L13 | twitch | done | `twitch-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L14 | groupme | done | `groupme-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L15 | nextcloud-talk | done | `nextcloud-talk-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L16 | linkedin | done | `linkedin-adapter.ts` | In `FULL_ADAPTER_CHANNELS` |
| CH-L17 | ntfy / pushover / gotify | done | push adapters | Live |
| CH-L18 | messenger / instagram | done | meta-graph adapters | Live |

### Extra adapters beyond doc baseline (~19 additional)

| ID | Channel | Status | Adapter |
|----|---------|--------|---------|
| CH-X01 | teams | done | `teams-adapter.ts` |
| CH-X02 | mattermost | done | `mattermost-adapter.ts` |
| CH-X03 | google-chat | done | `google-chat-adapter.ts` |
| CH-X04 | line | done | `line-adapter.ts` |
| CH-X05 | wechat | done | `wechat-adapter.ts` |
| CH-X06 | feishu | done | `feishu-chat-adapter.ts` |
| CH-X07 | dingtalk | done | `dingtalk-adapter.ts` |
| CH-X08 | viber | done | `viber-adapter.ts` |
| CH-X09 | imessage | done | `imessage-adapter.ts` |
| CH-X10 | email | done | `email-channel-adapter.ts` |
| CH-X11 | youtube | done | `youtube-adapter.ts` |
| CH-X12 | twitter/x | done | `twitter-adapter.ts` |
| CH-X13 | wire | done | `wire-adapter.ts` |
| CH-X14 | zalo | done | `zalo-adapter.ts` |
| CH-X15 | webex | done | `webex-adapter.ts` |
| CH-X16 | homeassistant | done | `homeassistant-channel-adapter.ts` |
| CH-X17 | api-server | done | `api-server-adapter.ts` |

### Stub channels (all complete)

| ID | Channel | Status | Adapter file | In stub set |
|----|---------|--------|--------------|-------------|
| CH-S01 | irc | done | `irc-adapter.ts` | no |
| CH-S02 | zulip | done | `zulip-adapter.ts` | no |
| CH-S03 | reddit | done | `reddit-adapter.ts` | no |
| CH-S04 | bluesky | done | `bluesky-adapter.ts` | no |
| CH-S05 | skype | done | `skype-adapter.ts` | no |
| CH-S06 | pumble | done | `pumble-adapter.ts` | no |
| CH-S07 | twist | done | `twist-adapter.ts` | no |
| CH-S08 | ryver | done | `ryver-adapter.ts` | no |
| CH-S09 | workplace | done | `workplace-adapter.ts` | no |
| CH-S10 | naver-works | done | `naver-works-adapter.ts` | no |
| CH-S11 | qq | done | `qq-adapter.ts` | no |
| CH-S12 | weibo | done | `weibo-adapter.ts` | no |
| CH-S13 | openhab | done | `openhab-adapter.ts` | no |
| CH-S14 | synology-chat | done | `synology-chat-adapter.ts` | no |
| CH-S15 | gitter | done | `gitter-adapter.ts` | no |
| CH-S16 | element | done | `element-adapter.ts` | no |
| CH-S17 | mastodon | done | `mastodon-adapter.ts` | no |
| CH-S18 | snapchat | done | `snapchat-adapter.ts` | no |
| CH-S19 | bridge-generic | done | `bridge-generic-adapter.ts` | no |
| CH-S20 | apple-business-chat | done | `apple-business-chat-adapter.ts` | no |

**Catalog source:** `src/gateway/channels/catalog-channel-specs.ts` (`CATALOG_STUB_CHANNELS` is empty)  
**Tests:** `src/gateway/channels/adapters/catalog-stub-adapters.test.ts` (221 channel tests pass)

---

## hermes_oddyseus_to_carina.md

Feature prompts 2-8 (email through named research/compare products).

| ID | Prompt | Status | Code | Test |
|----|--------|--------|------|------|
| HOC-02 | Full email (IMAP, SMTP, AI draft, reply UI) | done | `imap-fetcher.ts`, `smtp-sender.ts`, `email-api.ts`, `email.js` | email API tests |
| HOC-03 | 7-day learning curator | done | `src/skills/curator.ts`, `learning-loop.ts` | learning tests |
| HOC-04 | SearXNG self-hosted search | done | `web-search-provider.ts`, docker searxng service | `web-search.test.ts` |
| HOC-05 | Trello integration tool | done | `src/tools/trello.ts` | trello tests |
| HOC-06 | Workspace PWA / mobile polish | partial | Mobile HTML, PWA service-worker, `/surfaces` roadmap | manual |
| HOC-07 | Agent-authored themes | done | `src/api/theme-api.ts` | `theme-api.test.ts` |
| HOC-08 | Deep Research + Model Compare first-class | done | `deep-research.ts`, compare API/pages, workspace cards | research tests |

---

## UI-CLI-GUI-REPORT.md

Surface coverage vs Hermes (730+ files) and OpenClaw (966+ files).

| ID | Item | Status | Code | Test |
|----|------|--------|------|------|
| UCG-01 | CLI slash command registry | done | `src/cli/registry.ts`, completion metadata | CLI tests |
| UCG-02 | Web dashboard (core pages) | done | `packages/web/`, `app.carinaai.uk` | web tests |
| UCG-03 | Web pages: sessions, skills, models, config, logs, analytics | partial | Core ops pages + marketplace/surfaces | manual |
| UCG-04 | TUI (Hermes Ink-scale) | partial | `src/tui/` exists; smaller than Hermes 202 files | surfaces tests |
| UCG-05 | Mobile companion | partial | `mobile.html` / `mobile.js`, PWA cache | surfaces tests |
| UCG-06 | Channel depth (Telegram, Discord, Slack + more) | partial | 40 adapter files; 20 catalog stubs remain | channel tests |
| UCG-07 | i18n (3-5 languages target) | partial | en + es backend; web i18n loader restored | i18n tests |
| UCG-08 | Desktop app (Electron/Swift) | partial | `native/desktop/README.md` scaffold | manual |
| UCG-09 | Native Android app | partial | `native/mobile/README.md` scaffold | manual |
| UCG-10 | Plugin marketplace (ClawHub scale) | partial | `/marketplace`, `/api/marketplace/*` | manual |
| UCG-11 | Progressive enhancement roadmap (Month 1-6) | partial | `surfaces.html` roadmap page; native stubs | this tracker |

### Adoption phases (Section 6)

| Phase | Target | Status |
|-------|--------|--------|
| Phase 1 | CLI + web + Telegram/Discord/Slack | **done** |
| Phase 2 | TUI + i18n start | **partial** |
| Phase 3+ | Desktop, mobile native, marketplace | **partial** |

---

## SCOUT-INDEPENDENCE.md

Strategic product separation (Scout SaaS vs Carina SaaS). Also in `instructions/strategy/SCOUT-INDEPENDENCE.md`.

| ID | Surface | Status | Current | Target |
|----|---------|--------|---------|--------|
| SCI-01 | Scout signup/login (Scout-owned) | partial | `console.labyrinthscout.com` exists; register redirects to Carina checkout | Scout-native auth |
| SCI-02 | Checkout | missing | `core.carinaai.uk/checkout?plan=scout_*` in marketing + console | Scout Stripe checkout |
| SCI-03 | Billing portal (Scout Stripe account) | missing | Carina billing records | Scout-owned Stripe |
| SCI-04 | Provisioning on Scout webhook | partial | `scout-provisioning.ts` via Carina billing | Scout-native tenant + API key |
| SCI-05 | Scout console (first-class) | partial | `console.labyrinthscout.com` | No Carina proxy dependency |
| SCI-06 | Docs canonical at labyrinthscout.com | partial | Some Scout docs; Carina cross-links remain | Scout-owned docs hub |
| SCI-07 | Trust dashboard | missing | `carinaai.uk/trust` referenced | `labyrinthscout.com/trust` |
| SCI-08 | Marketing footer (Verlox/Scout only) | missing | Carina links + `carina-pulse` CSS in `labyrinthscout.com/index.html` | Scout branding |
| SCI-09 | Scout API keys (no Carina session) | partial | API key model exists | Fully decoupled auth |
| SCI-10 | Separate Scout database | partial | Console has migrations; shared infra possible | Strict tenant isolation |
| SCI-11 | Standalone deploy unit (`verlox/scout`) | partial | Console deploy separate; billing still Carina | Full product boundary |
| SCI-12 | npm package `@labyrinthscout/core` | missing | - | Installable without Carina |
| SCI-13 | Carina integration via API only | done | `LABYRINTH_ENABLED`, `SCOUT_API_KEY` in Carina `.env` | - |
| SCI-14 | Self-serve under 30 minutes | missing | Blocked by Carina checkout path | End-to-end Scout path |

**Key files to change for independence:**  
`labyrinthscout.com/index.html`, `console.labyrinthscout.com/public/**/*.html`, `console.labyrinthscout.com/src/api/account.ts` (`CHECKOUT_URL`)

---

## Prompt pack cross-reference (01-20)

| Prompt | Topic | Tracker sections |
|--------|-------|------------------|
| 01 | System prompt hardening | KPB, ASP, CAA Phase 1 |
| 02 | Memory discipline + compaction | KPB-10, ASP-09, CAA-03 |
| 03 | Turn ending + failure handling | KPB-03..05, CAA-15..17 |
| 04 | Casual messages + formatting | KPB-08, CAA-18 |
| 05 | Identity + bootstrap files | KPB-06..07, ASP-07, CAA-08/11 |
| 06 | Retry + self-repair | CAA-10, DGR (resilience) |
| 07 | Tool registry + mandatory tools | KPB-09, CAA-06/07 |
| 08 | Subagents + delegation | KPB-14, CAA-04/14 |
| 09 | Session history + memory search | COF-01, CAL |
| 10 | Plugin SDK + domain rule packs | KPB-12, CAA-09/21 |
| 11 | Provider management + cost guards | HP, DGR-C |
| 12 | Skills + marketplace | CAL-04, DGR-SK |
| 13 | Security + approvals | DGR-S |
| 14 | Channel adapters | CHANNEL-STUBS, UCG-06 |
| 15 | Streaming + telemetry | DGR-ST, DGR-O |
| 16 | i18n | DGR-I |
| 17 | Setup + Docker | DGR-D01..02 |
| 18 | Desktop/TUI/mobile surfaces | DGR-D03..06, UCG |
| 19 | Deep research + teacher | DGR-R, HOC-08 |
| 20 | Config + budget | HP, DGR-C, COF |

---

## Recommended next actions (priority order)

1. **SCI-02..08:** Scout checkout, billing, branding, trust, docs (commercial blocker).
2. **SCI-09..12, SCI-14:** API auth decoupling, Scout DB boundary, npm SDK, self-serve path.
3. **SCI-01:** Scout-native auth flow (replace Carina session dependency).
4. **KPB-06/07, ASP-07/08, CAL-06..11:** Identity/SOUL/personality and prompt assembly parity.
5. **UCG-03..11, DGR-D04..06, HOC-06:** Web/TUI/mobile/desktop surface partials.
6. **DGR-O02..O05, DGR-S*, DGR-ST*, DGR-C05/06, DGR-SK*:** Observability depth, security, streaming, cost, skills.

---

## How to update this tracker

1. Pick an **ID** row; change **Status** to `done`, `partial`, or `missing`.
2. Fill **Code** and **Test** columns when implementing.
3. Adjust summary counts at the top.
4. Re-audit after major releases; note date in header.

```bash
# Quick smoke: run targeted tests for a section
cd carina/core.carinaai.uk
pnpm exec vitest run src/agents/system-prompt.test.ts src/memory/context-budget.test.ts
```
