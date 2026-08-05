# Cross-Agent Deep Gaps Report

**Agents analyzed:** Hermes Agent (NousResearch), OpenClaw (openclaw), Odysseus (pewdiepie-archdaemon, 72k ⭐)
**Scope:** Safety, streaming, observability, i18n, cost tracking, skills, auth, doctor/repair, setup, docker, apps, deep research, teacher escalation
**Date:** 2026-06-16

---

## EXECUTIVE SUMMARY

22 additional patterns discovered beyond the first two reports. These cover the infrastructure layer; what makes an agent production-grade beyond just prompt quality. Karina currently has zero of these.

---

## 1. SAFETY & SECURITY

### What exists across all three

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| URL/path safety | Done:  url_safety.py, path_security.py, file_safety.py | Done:  Secure file operations | Done:  url_safety.py, url_security.py |
| Tool security | Done:  Tirith security tool | Done:  Exec approval levels | Done:  Admin/non-admin blocklist + plan mode allowlist |
| Approval system | Done:  Interactive approval with auto-deny for subagents | Done:  Plugin approvals, native approval cards | Failed:  No approval system |
| Redaction | Done:  agent/redact.py; strips sensitive text | Via logging security | Failed:  |
| Security audit | Done:  hermes_cli/security_audit.py | Via doctor | Failed:  |
| Security advisories | Done:  security_advisories.py | Failed:  | Failed:  |
| Rate limiting | Provider-level | Done:  auth-rate-limit.ts | Done:  In-memory sliding window |
| Prompt security | Implicit | Via safety section | Done:  prompt_security.py |

### Notable: Hermes Security Audit CLI

Hermes has a dedicated `security_audit.py` that checks:
- File permissions on sensitive paths
- API key exposure risks
- Gateway configuration vulnerabilities
- Plugin security posture

### Notable: Odysseus Plan Mode Allowlist

Instead of a blocklist, Odysseus' plan mode uses an ALLOWLIST. Any new tool defaults to BLOCKED; fail-safe design. This is superior to Hermes' blocklist approach.

### Notable: OpenClaw Exec Approval Levels

OpenClaw has tiered exec approvals:
- `tools.exec.ask`; always ask before executing
- `tools.exec.security`; protected paths
- Configurable per session, per tool

### GAP: Karina has NO safety systems
No URL safety, no path security, no approval system, no redaction, no rate limiting. Every one of these is critical before exposing Karina to users.

---

## 2. STREAMING INFRASTRUCTURE

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| SSE streaming | Done:  gateway/stream_consumer.py, stream_dispatch.py, stream_events.py | Done:  Full streaming pipeline across channels | Done:  SSE via llm_core |
| Token-level streaming | Done:  Per-provider adapter streaming | Done:  Channel streaming with token-delta | Done:  Stream with fallback |
| Streaming markdown | Done:  ui-tui streamingMarkdown.tsx | Done:  Channel draft streaming | Failed:  |
| Block streaming | Failed:  | Done:  block-streaming.ts | Failed:  |
| Stream controls | Failed:  | Done:  draft-stream-controls.ts | Failed:  |

### Notable: OpenClaw Streaming Pipeline

OpenClaw has the most sophisticated streaming:
- Per-channel streaming with platform-specific chunking
- Block streaming (send content in chunks for long messages)
- Stream controls (pause, resume, cancel)
- Token-delta rules (no token-delta on external messaging)

### GAP: Karina streaming
Check if Karina has SSE streaming or token-level streaming. If not, this is essential for responsive user experience.

---

## 3. OBSERVABILITY & MONITORING

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| OpenTelemetry | Failed:  | Done:  opentelemetry.md, telemetry.ts | Failed:  |
| LLM observability | Done:  Langfuse + Nemo Relay plugins | Done:  Session telemetry, model fallback observation | Failed:  |
| Subagent metrics | Via logs | Done:  subagent-session-metrics.ts | Failed:  |
| Prompt cache observability | Implicit | Done:  prompt-cache-observability.ts | Failed:  |
| Error observation | Per-adapter | Done:  embedded-agent-error-observation.ts | Failed:  |
| Auth state observation | Failed:  | Done:  auth-profiles/state-observation.ts | Failed:  |
| Usage metrics | Done:  UI usage.ts | Done:  ui/usage-metrics.ts | Failed:  |
| Channel health | Gateway-level | Done:  channel-health-monitor.ts | Failed:  |
| Logging system | Done:  Profile-aware logs | Done:  Subsystem loggers | Basic |

### Notable: OpenClaw Telemetry Surface

OpenClaw has the most mature observability with dedicated files for:
- Prompt cache efficiency tracking
- Model fallback monitoring
- Subagent session metrics
- Embedded agent error classification
- Auth profile state changes
- Channel health monitoring

### GAP: Karina has zero observability
No telemetry, no metrics, no usage tracking, no error classification. There is no way to know if Karina is working correctly, degrading, or costing money.

---

## 4. INTERNATIONALIZATION (i18n)

### What exists

Hermes ships with **10 locales**:
- Chinese (Simplified + Traditional), Korean, Ukrainian, Turkish, German, Hungarian, Irish, Japanese, French

OpenClaw and Odysseus have no i18n system.

### Notable: Hermes i18n Architecture

Each locale is a YAML file containing translated strings for the UI. The desktop app (`apps/desktop/src/i18n/`) has its own i18n layer.

### GAP: Karina is English-only
This limits market reach. At minimum, system prompt should be translatable.

---

## 5. COST TRACKING & BUDGET MANAGEMENT

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Iteration budget | Done:  thread-safe counter, parent 90/subagent 50, refund support | Via sessions | Failed:  |
| API quota polling | Done:  account_usage.py; polls provider APIs for remaining quota | Done:  provider-usage.ts | Failed:  |
| Cost guard/warnings | Done:  model_cost_guard.py; warns before expensive model selection | Via TokenJuice | Failed:  |
| Usage pricing | Done:  usage_pricing.py | Done:  session-cost-usage.ts | Failed:  |
| Token counting | Done:  estimate_messages_tokens_rough | Failed:  | Done:  estimate_tokens |
| Spend tracking | Failed:  | Done:  /usage-metrics UI | Failed:  |
| Provider cost-aware | Done:  models.dev with pricing data | Done:  provider catalogs | Failed:  |

### Notable: Hermes IterationBudget

Thread-safe counter with refund mechanism. Parent cap 90 iterations, subagent cap 50 (configurable). `execute_code` turns are refunded (don't count against budget). This prevents runaway agent loops without hard-killing the session.

### Notable: Hermes Model Cost Guard

Warns users before selecting models above cost thresholds ($20/M input, $100/M output). Suggests cheaper alternatives. Prevents accidental $100+ API bills from one session.

### Notable: OpenClaw TokenJuice

Dedicated usage tracking system at `docs/tools/tokenjuice.md`. Tracks per-session, per-provider, per-model spend with configurable budgets.

### GAP: Karina has NO cost tracking
No iteration budget, no quota polling, no cost warnings, no spend tracking. A runaway loop or expensive model selection could burn through API credits with no guard.

---

## 6. SKILLS & ABILITY SYSTEMS

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Skill count | 73 built-in skills | ClawHub registry | 2 via integrations |
| Frontmatter/validation | Done:  YAML frontmatter, preprocessing, validation | Done:  Full frontmatter system | Basic |
| Environment gating | Done:  prerequisites, env vars, platform filters | Done:  Agent filter, session gating | Failed:  |
| Skill workshop | Done:  skill_manage tool (agent creates/patches skills) | Done:  Full workshop subsystem (60 files) | Failed:  |
| Skill installation | Local filesystem | ClawHub, archive, git, upload | Via integrations |
| Security scanning | Basic | Done:  scanner.ts, workspace-audit.ts, clawhub-verdicts.ts | Failed:  |
| Version tracking | SHA256 hash | Done:  skill-version.ts | Failed:  |
| Skill discovery | Auto-scan directories | Done:  Full discovery pipeline | Basic |
| Runtime refresh | Failed:  | Done:  refresh.ts, refresh-state.ts | Failed:  |
| Research autosave | Failed:  | Done:  research/autocapture.ts (saves skills from sessions) | Failed:  |

### Notable: OpenClaw Skill Subsystem (60+ files)

OpenClaw's skill system is an order of magnitude more sophisticated than the others:

**Discovery pipeline:**
```
agent-filter → bins → chat-command-invocation → command-specs → 
skill-index → status → filter
```

**Lifecycle pipeline:**
```
clawhub → install-download → install-extract → install → 
archive-install → source-install → upload-install → workspace-skill-write
```

**Security pipeline:**
```
clawhub-verdicts → scanner → workspace-audit
```

**Research autosave:** `research/autocapture.ts` automatically saves successful problem-solving patterns as skills during sessions.

### Notable: OpenClaw ClawHub

`clawhub.ai`; a public skill + plugin registry. Agents can:
- Search for skills by capability
- Install skills with one command
- Publish their own skills
- Get security-verified skills

This creates a network effect; every skill improves every agent.

### Notable: Hermes Skill Preprocessing

`skill_preprocessing.py` (140 lines) handles:
- Template variable substitution (`$VAR`, `${VAR}`)
- Inline shell expansion
- Environment variable capture
- Prerequisite checking
- Platform-specific filtering
- Gateway setup hints

### GAP: Karina skills are minimal/nonexistent
No skill format, no discovery, no workshop, no security scanning, no version tracking, no ClawHub equivalent.

---

## 7. AUTHENTICATION & IDENTITY

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| OAuth providers | Google, Microsoft, MCP, Qwen, Dashboard | Full OAuth system | Failed:  |
| API tokens | Via gateway | Done:  device-auth.ts | Done:  ody_ Bearer tokens |
| Auth modes | Gateway authz_mixin | Multiple auth modes (cookie, token, proxy) | Cookie + token |
| Auth rate limiting | Failed:  | Done:  auth-rate-limit.ts | Failed:  |
| Device auth | Failed:  | Done:  device-auth.ts, device-identity.ts | Done:  companion pairing |
| Multi-agent auth | Via credential pool | Done:  agent-auth-credentials, auth-profiles | Failed:  |
| Trusted proxy | Failed:  | Done:  trusted-proxy-auth.md | Failed:  |
| Session identity | Per-session | Done:  session-identity, assistant-identity | Per-session |

### Notable: OpenClaw Auth System

OpenClaw has the most complete auth:
- Multiple auth modes: cookie, Bearer token, trusted proxy
- Device identity (macOS, Android, iOS)
- Agent-scoped auth profiles (different agents, different credentials)
- OAuth with per-provider credential management
- Auth rate limiting to prevent brute force
- Auth state observation for monitoring

### Notable: Odysseus Companion Pairing

`companion/pairing.py` lets a phone client discover and pair with the Odysseus server on LAN. The pairing flow:
1. Phone discovers server via LAN
2. Admin approves pairing in web UI
3. Phone gets a `ody_` Bearer token
4. Token is scoped to the admin's identity

### GAP: Karina auth is basic
Check if Karina has multi-agent auth, OAuth support, device auth, or auth rate limiting.

---

## 8. DOCTOR / SELF-REPAIR

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Doctor command | Via CLI | Done:  openclaw doctor --fix | Failed:  |
| Config migration | docker_config_migrate.py | Done:  legacy-config-repair.ts | Failed:  |
| State migration | Failed:  | Done:  Cron store migration, legacy delivery migration | Failed:  |
| Channel repair | Failed:  | Done:  channel-capabilities.ts | Failed:  |
| Context engine repair | Failed:  | Done:  context-engine-host-compat.ts | Failed:  |
| Dreaming repair | Failed:  | Done:  dreaming-payload-migration.ts | Failed:  |
| Diagnostic trace | Failed:  | Done:  diagnostic-trace-context.ts | Failed:  |

### Notable: OpenClaw Doctor

`openclaw doctor --fix` is a comprehensive self-repair system:
- Detects and fixes config issues
- Migrates old state formats to current
- Repairs cron job state
- Fixes channel capability mismatches
- Restores context engine compatibility
- Emits structured repair notes

This is critical for long-running agents; without it, users accumulate broken state over time.

### GAP: Karina has zero self-repair
No doctor, no migration, no repair. Any config or state corruption requires manual intervention.

---

## 9. SETUP & ONBOARDING

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Setup wizard | Done:  CLI setup.py (58 lines) | Done:  Full onboarding CLI | Basic |
| Install scripts | Linux, macOS, Windows (ps1, cmd, sh) | macOS app with onboarding screens | Docker |
| First-run experience | SOUL.md seeding, AGENTS.md creation | BOOTSTRAP.md for new workspaces | Default presets |
| Configure wizards | Done:  hermes tools, hermes setup | Done:  openclaw configure | Via settings API |
| Platform-specific | Done:  install.sh, install.ps1, install.cmd | macOS native app | Docker only |

### Notable: OpenClaw macOS Onboarding

OpenClaw's macOS app has a visual onboarding flow with security notice screens, provider selection, and workspace setup. This is the most polished first-run experience.

### Notable: Hermes SOUL.md Seeding

On first run, Hermes creates `~/.hermes/SOUL.md` from `DEFAULT_SOUL_MD` template. This gives the agent an identity from moment one, even before the user customizes it.

### GAP: Karina onboarding
Check what Karina's setup experience looks like. Is there a first-run wizard? Install scripts? Workspace seeding?

---

## 10. DOCKER & CONTAINERIZATION

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Docker image | Done:  Full s6-overlay | Done:  docker-compose.yml | Done:  GPU docker configs |
| Multi-container | Done:  main-hermes + dashboard services | Basic | AMD + NVIDIA GPU variants |
| Supervision | Done:  s6-overlay with dependencies | Failed:  | Failed:  |
| Profiles in Docker | Done:  cont-init.d/02-reconcile-profiles | Failed:  | Failed:  |
| GPU support | Failed:  | Failed:  | Done:  NVIDIA + AMD configs |
| Entrypoint | Done:  entrypoint.sh + main-wrapper.sh | Basic | Done:  entrypoint.sh |

### Notable: Hermes s6-overlay Supervision

Hermes uses s6-overlay for process supervision in Docker:
- `main-hermes` service (the agent)
- `dashboard` service (web UI)
- Dependency management between services
- Clean shutdown and restart
- Profile reconciliation on container init

### Notable: Odysseus GPU Docker

Odysseus ships GPU docker configs for both NVIDIA and AMD. This is because Odysseus is designed to run local models; GPU support is essential.

### GAP: Karina containerization
Check if Karina has Docker support. Essential for deployment.

---

## 11. DESKTOP & MOBILE APPS

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Desktop app | Done:  Electron (desktop/) + Tauri (bootstrap-installer/) | Done:  macOS native Swift/SwiftUI | Failed:  |
| TUI | Done:  Ink React TUI | Done:  TUI | Failed:  |
| Web dashboard | Done:  Web UI (React) | Done:  Gateway web UI | Done:  Built-in web UI |
| Mobile companion | Failed:  | Failed:  | Done:  companion pairing for phone |
| Cross-platform | Linux, macOS, Windows | macOS (native), Linux/Windows (CLI) | Web-based |

### Notable: Hermes Multi-App Architecture

Hermes ships FOUR surfaces:
1. Classic CLI (prompt_toolkit)
2. TUI (Ink/React terminal UI)
3. Desktop (Electron + React)
4. Web Dashboard (React + embedded TUI via PTY bridge)

### Notable: OpenClaw macOS Native

OpenClaw's macOS app is native Swift/SwiftUI; not Electron. This provides better performance, energy efficiency, and OS integration (system tray, notifications, TCC permissions).

### Notable: Odysseus Companion Pairing

`companion/` enables phone-to-server pairing over LAN. The phone doesn't run an agent; it connects to the server. This is simpler than a full mobile app and works for any phone with a browser.

### GAP: Karina surfaces
Karina has a web UI and Telegram. Does it need a desktop app? A TUI? A companion pairing system?

---

## 12. DEEP RESEARCH (Odysseus only)

### Odysseus DeepResearcher

A full autonomous research pipeline:
```
User question
  → _classify_category (fast LLM call)
  → _create_plan (structured research plan)
  → _generate_queries (search queries)
  → _search_and_extract (parallel web search + content extraction)
    → _search (web search)
    → _fetch_and_extract (URL fetch + content extraction)
  → _synthesize (consolidate findings)
  → _should_stop (quality gate; is report good enough?)
  → _final_report (polished output)
```

Features:
- Iterative refinement (loops until quality gate passes)
- Parallel search across multiple queries
- Content extraction from fetched pages
- Category classification for domain-specific handling
- Streaming progress to UI
- Cancellable at any point

### GAP: Karina deep research
Karina has no autonomous research pipeline. Research requires the user to manually guide each step.

---

## 13. TEACHER ESCALATION (Odysseus only)

### Odysseus Teacher System

When a local (self-hosted) model fails a turn, Odysseus:
1. Evaluates the failure (regex on tool outputs + agent reply)
2. Escalates to a SOTA cloud teacher model
3. Teacher produces a corrective reply
4. Teacher ALSO writes a SKILL.md procedure
5. Next time the local model hits the same task, it can load the skill and succeed

**Detection tiers:**
- Tier 1: Regex on tool outputs (free, instant); catches "Unknown action", "I don't have a tool", "Could you tell me which one?"
- Tier 2 (TODO): LLM self-eval for ambiguous cases

**SOTA host detection:**
If the student is already running on a SOTA cloud API (OpenAI, Anthropic, DeepSeek), escalation is OFF; the user is already paying for a top model.

### Why this matters for Karina

Karina runs on DeepSeek (a weaker model) with Claude as an occasional fallback. The teacher escalation pattern would let Karina:
1. Try with DeepSeek first (cheap)
2. If it fails, auto-escalate to Claude (expensive but correct)
3. Save the successful Claude response as a skill
4. Next time, DeepSeek can handle it using the skill

This is the single most efficient pattern for cost-quality tradeoff.

---

## 14. CONFIGURATION MANAGEMENT

### What exists

| Capability | Hermes | OpenClaw | Odysseus |
|-----------|--------|----------|----------|
| Config system | Done:  config.py (6585 lines); YAML-based | Done:  30+ config files, typed config system | Basic (settings.json) |
| Config validation | Via YAML schema | Done:  TypeBox schemas, allowed-values.ts | Basic |
| Config migration | docker_config_migrate.py | Done:  legacy-config-repair.ts | Failed:  |
| Env var management | .env for secrets, config.yaml for settings | Config + env vars | settings.json |
| Per-agent config | Via profiles | Done:  agent-dirs, agent-limits, agent-runtime-config | Failed:  |
| Config doctor | Via CLI | Done:  doctor command | Failed:  |

### Notable: OpenClaw Config Architecture

OpenClaw has the most comprehensive config:
- 30+ config type files
- Typed schemas (TypeBox) for validation
- Agent-scoped config (different settings per agent)
- Config bounds (allowed-values.ts)
- Config environment variable mapping
- Config backup rotation
- Config cache utilities

### GAP: Karina config
Check how Karina handles configuration. Is there a typed schema? Validation? Migration? Per-agent config?

---

## 15. ADDITIONAL PATTERNS (not in first two reports)

### 15.1 Hermes: Thread-Safe Iteration Budget
```
IterationBudget class:
- max_total cap (parent 90, subagent 50)
- Thread-safe consume/refund
- execute_code turns refunded
- Grace call: one extra turn when budget exhausted but mid-work
```
**Adopt for Karina:** Runaway loop prevention.

### 15.2 Hermes: API Quota Polling
```
account_usage.py:
- Polls provider APIs for remaining quota
- Displays usage windows (daily, monthly)
- Warns when approaching limits
- Supports OpenAI, Anthropic, Codex
```
**Adopt for Karina:** Prevents mid-session quota exhaustion.

### 15.3 Hermes: Model Cost Guard
```
model_cost_guard.py:
- Warns before selecting models above $20/M input, $100/M output
- Suggests cheaper alternatives
- Prevents accidental expensive model selection
```
**Adopt for Karina:** Protects against bill shock.

### 15.4 OpenClaw: ClawHub Skill Registry
```
clawhub.ai:
- Public registry for skills and plugins
- Search, install, publish
- Security verification
- Network effect: every skill improves every agent
```
**Adopt for Karina:** Eventually; a Karina skill marketplace.

### 15.5 OpenClaw: Doctor/Self-Repair
```
openclaw doctor --fix:
- Config migrations
- State store migrations
- Cron repair
- Channel capability repair
- Context engine compatibility
```
**Adopt for Karina:** Essential for long-running production agents.

### 15.6 OpenClaw: Research Autosave
```
research/autocapture.ts:
- During agent sessions, detects when the agent solves a novel problem
- Automatically saves the solution as a skill
- No user intervention needed
```
**Adopt for Karina:** Self-improving agent.

### 15.7 Odysseus: Deep Research Pipeline
```
DeepResearcher:
- classify → plan → search → extract → synthesize → gate → report
- Iterative until quality passes
- Parallel search
- Streaming progress
```
**Adopt for Karina:** Autonomous research capability.

### 15.8 Odysseus: Teacher Escalation
```
Teacher escalation:
- Local model tries first (cheap)
- On failure → SOTA cloud model fixes it (correct)
- Saves fix as SKILL.md (learns)
- Next time local model handles it (cheap + correct)
```
**Adopt for Karina:** Cost-quality optimization.

### 15.9 Odysseus: Plan Mode Allowlist
```
Plan mode:
- Allowlist (NOT blocklist) of safe tools
- Any new tool defaults to BLOCKED
- Fail-safe design
```
**Adopt for Karina:** Safer than blocklist approach.

### 15.10 Hermes: s6-overlay Docker Supervision
```
s6-overlay:
- Process supervision for multi-service containers
- Dependency management
- Clean shutdown/restart
- Profile reconciliation
```
**Adopt for Karina:** Production-grade containerization.

---

## 16. KARINA GAP SUMMARY

### Critical Gaps (must fix before production)

| # | Gap | Source to copy | Effort |
|---|-----|---------------|--------|
| 1 | No URL/path safety | Hermes url_safety.py + path_security.py | Low |
| 2 | No approval system | Hermes approval.py | Medium |
| 3 | No rate limiting | Odysseus rate_limiter.py | Low |
| 4 | No iteration budget | Hermes iteration_budget.py | Low |
| 5 | No cost tracking/warnings | Hermes model_cost_guard.py + account_usage.py | Medium |

### Important Gaps (should fix soon)

| # | Gap | Source to copy | Effort |
|---|-----|---------------|--------|
| 6 | No observability/telemetry | OpenClaw telemetry.ts + session-telemetry.ts | High |
| 7 | No doctor/self-repair | OpenClaw doctor command | High |
| 8 | No skill system | Hermes skill format (simpler than OpenClaw) | Medium |
| 9 | No deep research | Odysseus DeepResearcher | High |
| 10 | No streaming infrastructure | Check existing; adopt OpenClaw pattern if missing | Medium |

### Nice-to-Have Gaps

| # | Gap | Source to copy | Effort |
|---|-----|---------------|--------|
| 11 | No i18n | Hermes locale system | Medium |
| 12 | No teacher escalation | Odysseus teacher_escalation.py | Medium |
| 13 | No skill workshop (agent creates skills) | Hermes skill_manage tool | Medium |
| 14 | No research autosave | OpenClaw autocapture.ts | High |
| 15 | No ClawHub equivalent | OpenClaw clawhub system | Very High |
| 16 | No s6-overlay Docker | Hermes docker/s6-rc.d | Medium |
| 17 | No companion pairing | Odysseus companion/pairing.py | Low |
| 18 | No plan mode (safe exploration) | Odysseus tool_security.py allowlist | Low |
| 19 | No config validation/migration | OpenClaw config system | High |
| 20 | No multi-surface apps (TUI, desktop) | Hermes multi-app architecture | Very High |

---

## 17. PRIORITY ROADMAP

### Phase 1; Safety (this week, ~200 lines)
```
1. Copy Odysseus rate_limiter.py → Karina rate limiting
2. Copy Hermes url_safety.py patterns → Karina URL safety
3. Copy Hermes path_security.py → Karina file safety
4. Copy Hermes iteration_budget.py → Karina loop guard
5. Inject safety rules into Karina system prompt
```

### Phase 2; Reliability (next week, ~500 lines)
```
6. Copy Hermes approval.py pattern → Karina approval
7. Copy Hermes model_cost_guard.py → Karina cost warnings
8. Copy Hermes account_usage.py → Karina quota polling
9. Implement basic skill format (Hermes YAML frontmatter pattern)
```

### Phase 3; Observability (week 3, ~1000 lines)
```
10. Implement basic telemetry (session metrics, error classification)
11. Implement usage tracking per session/provider
12. Add structured logging
```

### Phase 4; Self-Improvement (week 4-5, ~2000 lines)
```
13. Implement teacher escalation (Odysseus pattern)
14. Implement deep research (Odysseus DeepResearcher pattern)
15. Implement doctor/self-repair basics
```

### Phase 5; Ecosystem (future)
```
16. Skill marketplace / registry
17. Multi-surface apps
18. Full plugin SDK
19. i18n
20. Research autosave
```

---

## NOTES

- The teacher escalation pattern (Odysseus) is the highest-leverage feature for Karina specifically; it directly addresses the cost-quality tradeoff of running on DeepSeek with Claude as fallback
- OpenClaw's ClawHub is the most powerful ecosystem feature but requires the most infrastructure; start with Hermes' simpler skill format first
- Odysseus' plan mode allowlist is the simplest safety improvement to implement (one set, one conditional)
- Hermes' iteration budget is 62 lines of Python; copy it verbatim
- All three agents agree: the agent should never be able to spend money or take destructive actions without guardrails; Karina needs these before user exposure