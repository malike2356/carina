# Cross-Agent Deep Architecture Report

**Agents analyzed:** Hermes Agent (NousResearch), OpenClaw (openclaw), Odysseus (pewdiepie-archdaemon, 72k ⭐)
**Scope:** Tool systems, memory, sessions, delegation, error handling, context management, plugins, channels, providers
**Date:** 2026-06-16

---

## TABLE OF CONTENTS

1. [Tool Systems](#1-tool-systems)
2. [Memory Systems](#2-memory-systems)
3. [Session Management](#3-session-management)
4. [Delegation & Subagents](#4-delegation--subagents)
5. [Error Handling & Resilience](#5-error-handling--resilience)
6. [Context Management](#6-context-management)
7. [Plugin & Extension Systems](#7-plugin--extension-systems)
8. [Channel & Platform Support](#8-channel--platform-support)
9. [Provider & Model Management](#9-provider--model-management)
10. [What Karina Should Adopt](#10-what-karina-should-adopt)
11. [Implementation Priorities](#11-implementation-priorities)

---

## 1. TOOL SYSTEMS

### Hermes Agent

**Architecture:** Registry-based auto-discovery. Each tool file calls `registry.register()` at import time. `model_tools.py` imports the registry, triggers discovery, and builds the tool schema list.

**Key files:**
- `tools/registry.py`; central registry (25 `register()` calls)
- `model_tools.py`; orchestration, `discover_builtin_tools()`, `handle_function_call()`
- `toolsets.py`; toolset definitions, `_HERMES_CORE_TOOLS` list
- Individual tool files in `tools/*.py` (~50+ tools)

**Tool lifecycle:**
```
tools/registry.py (no deps)
    ↑
tools/*.py (each calls registry.register())
    ↑
model_tools.py (imports registry → triggers discovery)
    ↑
run_agent.py / cli.py (calls model_tools)
```

**Toolset system:** Tools are grouped into named toolsets (terminal, file, web, browser, delegation, memory, etc.). Sessions enable/disable entire toolsets. Subagents get restricted toolsets.

**Blocked tools for subagents:** `delegate_task`, `clarify`, `memory`, `send_message`, `execute_code`

**Critical design:** The bar for new core tools is HIGH because every tool ships on every API call. Most new capability goes through: CLI command + skill → service-gated tool → plugin → MCP server → core tool (last resort).

### OpenClaw

**Architecture:** TypeScript-based, session-scoped tool provision. Tools are created per-session with runtime config baked in. Uses TypeBox for schema validation.

**Key files:**
- `src/agents/tools/*.ts`; individual tool implementations
- `src/agents/tools/common.ts`; shared helpers, `jsonResult`, param readers
- `src/agents/tools/tool-definition-wrapper.ts`; wraps tools with session context
- `src/agents/tool-description-presets.ts`; reusable tool descriptions

**Tool types:**
- Built-in tools (terminal, read_file, write, edit, find, grep, ls, browser, web_search, etc.)
- Session-scoped tools (created per agent session with runtime state)
- Plugin-provided tools (via plugin SDK)
- MCP tools (discovered from configured MCP servers)

**Distinctive features:**
- `sessions_spawn`; spawn subagent sessions with inherited tool policy
- `gateway` tool; agent can call back into OpenClaw's own gateway for config/restart
- `skill_workshop`; agent can create/update skills at runtime
- Auto-completion wake: background tasks notify on completion (push-based, no polling)

### Odysseus

**Architecture:** Fenced-code-block tool format (no native function calling for smaller models). Three parsing strategies: fenced blocks, `[TOOL_CALL]` blocks, XML `<invoke>` blocks. Falls back to native tool schemas for API-supported models.

**Key files:**
- `src/tool_parsing.py`; regex-based parsing of 5+ tool formats
- `src/tool_schemas.py`; OpenAI-style tool schema generation
- `src/tool_execution.py`; tool dispatch and execution
- `src/tool_implementations.py`; ~1200 lines of tool implementations
- `src/tool_index.py`; embedding-based tool selection for large tool sets
- `src/tool_security.py`; admin vs non-admin tool blocking
- `src/tool_policy.py`; per-user tool restrictions

**Tool format (fenced blocks):**
```
```bash
ls -la
```
```

**Tool selection system:** Instead of sending all tool schemas, Odysseus uses `tool_index.py` with embedding-based selection. Smaller models get curated tool lists. This is critical for running on local models with limited context.

**Security model:** Clear admin/non-admin split. `NON_ADMIN_BLOCKED_TOOLS` set blocks shell, file ops, memory, email, calendar, model serving for non-admin users. Plan mode uses an allowlist (safer; new tools default to blocked).

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Tool format | Native function calling | Native function calling | Fenced blocks + native fallback |
| Registration | Auto-discovery via registry | Per-session creation | Hardcoded in tool_implementations.py |
| Tool selection | Toolset enable/disable | Session-scoped provision | Embedding-based or full list |
| Subagent tools | Blocklist (5 tools blocked) | Inherited policy | Admin/non-admin split |
| New tool bar | Very high (core tool last resort) | Plugin SDK preferred | Moderate (single file to add) |
| Tool descriptions | In Python tool files | In TypeScript tool files | In TOOL_SECTIONS dict + overrides |
| Security | Per-tool gating | Tool policy + exec approvals | Admin/non-admin + plan mode allowlist |

---

## 2. MEMORY SYSTEMS

### Hermes Agent

**Dual approach:** Built-in MEMORY.md + pluggable memory providers.

**Built-in memory:**
- `MEMORY.md` at `~/.hermes/MEMORY.md`; markdown file
- `USER.md` at `~/.hermes/USER.md`; user profile
- Memory tool allows add/replace/remove with declarative facts
- Strict discipline: no stale artifacts, no instructions-to-self
- Memory injected into every turn via volatile tier of system prompt

**Pluggable providers** (8 total):
```
plugins/memory/
├── byterover/; byte-level storage
├── hindsight/; retrospective extraction
├── holographic/; associative memory
├── honcho/; conversation memory
├── mem0/; semantic memory
├── openviking/; context database
├── retaindb/; retention-based
└── supermemory/; vector-based
```

**Memory discipline rules (shipped to every session):**
- Prioritize what reduces future user steering
- Do NOT save task progress, session outcomes, PR numbers, commit SHAs
- Write declarative facts, not instructions
- Procedures → skills, not memory

### OpenClaw

**Architecture:** Extension-based. `memory-core` extension provides the memory subsystem. Uses `MEMORY.md` as curated summary + `memory/*.md` daily files for detailed history.

**Key system:**
- `MEMORY.md`; curated long-term summary (injected into context)
- `memory/*.md`; daily detailed notes (accessed via `memory_search`/`memory_get` tools on demand)
- SQLite-backed embeddings for semantic search
- "Dreaming" subsystem; periodic background consolidation of daily notes into curated summary
- Embedding providers: OpenAI, local, or configurable

**Memory search:** `memory_search` and `memory_get` tools let the agent query memory on demand instead of having everything injected into context. This is more scalable than Hermes' approach.

**Dreaming pipeline:**
```
Daily notes (memory/*.md)
    → Embedding index (SQLite)
    → Dreaming consolidation (periodic LLM job)
    → Curated MEMORY.md (compact summary)
```

### Odysseus

**Architecture:** Simple JSON file + Jaccard similarity.

**Key system:**
- `memory.json`; flat JSON array of memory entries
- Jaccard similarity for duplicate detection
- Keyword-based relevance (token overlap, no embeddings)
- Inline memory commands: agent can parse `/remember` style commands from chat
- Category system: fact, preference, etc.
- Owner scoping for multi-user

**Comparison:**

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Storage | MEMORY.md (markdown) + 8 providers | MEMORY.md + SQLite embeddings | memory.json (simple JSON) |
| Search | FTS5 via session DB | Semantic via embeddings | Jaccard similarity |
| Consolidation | Manual (agent writes) | Dreaming (automatic background) | Manual |
| Multi-user | Via profile system | Agent-scoped | Owner field |
| Scalability | Medium (markdown file) | High (SQLite + embeddings) | Low (JSON file) |
| Discipline guidance | Done:  Strong | Implicit | None |

---

## 3. SESSION MANAGEMENT

### Hermes Agent

**Architecture:** `hermes_state.py`; SessionDB with SQLite + FTS5 full-text search.

**Key features:**
- SQLite session store with FTS5 indexing
- `session_search` tool; search past sessions by keyword
- Session lineage tracking (parent/child for subagents)
- Bookend + window retrieval (context around matches)
- Three retrieval shapes: DISCOVERY (FTS5 search), SCROLL (paginate within session), BROWSE (recent sessions)
- Cross-session context injection via session_search

### OpenClaw

**Architecture:** Agent-scoped sessions with separate SQLite databases.

**Key features:**
- `agents/<agentId>/agent/openclaw-agent.sqlite`; per-agent session DB
- `state/openclaw.sqlite`; global shared state
- Session key (UUID) identifies each conversation
- Session spawn for subagents with inherited context
- Session list, resume, truncate operations
- Gateway-managed session lifecycle

### Odysseus

**Architecture:** Session actions via `src/session_actions.py` (250 lines) + agent loop in `src/agent_loop.py` (3170 lines).

**Key features:**
- Session CRUD via API
- Session truncation (trim history)
- Cross-session search (`search_chats` tool)
- Session linking in responses (clickable `[Name](#session-<id>)` anchors)
- Task-based sessions for recurring jobs

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Storage | Single SQLite + FTS5 | Per-agent SQLite + shared DB | API-backed |
| Search | FTS5 full-text | Via memory tools | search_chats tool |
| Subagent lineage | Tracked in session DB | Controller session key | N/A |
| Cross-session context | session_search tool | memory_search tool | search_chats tool |
| UI integration | CLI + TUI + Desktop | Gateway + TUI + apps | Web UI anchors |

---

## 4. DELEGATION & SUBAGENTS

### Hermes Agent

**Architecture:** `delegate_task` tool (3105 lines). Single most sophisticated subagent system.

**Key features:**
- **Two modes:** Single task (`goal` + `context`) or Batch (`tasks` array, up to 3 parallel)
- **Two roles:** `leaf` (no further delegation) and `orchestrator` (can spawn workers)
- **Nesting control:** `max_spawn_depth` config (default: 1; one level deep)
- **Isolation:** Each subagent gets fresh conversation, own terminal session, own task_id
- **Restricted toolsets:** 5 tools blocked (delegate_task, clarify, memory, send_message, execute_code)
- **Thread pool:** ThreadPoolExecutor with non-interactive approval callback
- **Auto-approve/deny:** Configurable for cron/batch use
- **Subagent approval:** Safe default (auto-deny) with opt-in auto-approve
- **Result:** Only summary returns to parent; intermediate tool calls never flood parent context
- **Deadlock protection:** Worker threads get non-interactive approval callbacks (no stdin blocking)

**Blocked tools for subagents:**
```
delegate_task   → no recursive delegation
clarify         → no user interaction
memory          → no writes to shared MEMORY.md
send_message    → no cross-platform side effects
execute_code    → children should reason step-by-step
```

**When to use vs. not use:**
- USE: reasoning-heavy subtasks, tasks that would flood context, parallel independent work
- DON'T USE: mechanical multi-step work (use execute_code), single tool calls, tasks needing user interaction

### OpenClaw

**Architecture:** `sessions_spawn` tool with two runtimes: `subagent` and `acp`.

**Key features:**
- Two spawn modes: `run` (one-shot task) and `session` (persistent conversation)
- ACP runtime for external agents (Codex, Claude Code, etc.)
- Inherited tool policy from parent
- Delivery context for results routing
- Thread binding for channel-aware spawning
- Auto-completion wake (push-based, no polling)
- Subagent registry with state tracking (SQLite)

**Minimal prompt mode:** Subagents get `promptMode=minimal`; strips memory recall, identity, output directives, messaging, heartbeats. Keeps tooling, safety, skills, workspace.

### Odysseus

**Architecture:** Teacher escalation (`src/teacher_escalation.py`); not true subagents.

**Key features:**
- `ask_teacher` tool; escalate to a smarter model for help
- Custom teacher system prompt
- Not a general-purpose subagent system

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Modes | Single + Batch (parallel) | run + session | Escalation only |
| Roles | leaf + orchestrator | N/A | N/A |
| Nesting depth | Configurable (default 1) | Implicit via spawn | None |
| Tool restriction | Blocklist (5 tools) | Inherited policy | Admin/non-admin |
| External agents | No | Yes (ACP) | No |
| Prompt mode | Custom system prompt | promptMode=minimal | Teacher prompt |
| Completion signal | Blocking (parent waits) | Push-based wake | N/A |
| Deadlock protection | TLS approval callbacks | Promise-based | N/A |

---

## 5. ERROR HANDLING & RESILIENCE

### Hermes Agent

**Error classification:** Provider adapters classify errors for different recovery strategies.

**Key patterns:**
- `context_overflow` → compress context and retry (Bedrock adapter)
- `throttling` / `rate_limit` → backoff + retry
- Image size errors → shrink and retry transparently
- Connection errors → retry with exponential backoff
- Model-specific error patterns per provider adapter

**Context compression on error:** When context overflows, Hermes auto-compresses middle turns and retries the same request; no user intervention.

**Fallback model chain:** `DEFAULT_PROVIDER` → first paid provider with key → free GitHub Copilot → error. DeepSeek no longer hardcoded.

### OpenClaw

**Architecture:** Formal retry infrastructure with configurable policies.

**Retry system** (`src/infra/retry.ts`, `src/infra/retry-policy.ts`):
```typescript
// Channel API retry defaults
CHANNEL_API_RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 400,
  maxDelayMs: 30_000,
  jitter: 0.1,
}

// Error pattern matching
CHANNEL_API_RETRY_RE = /429|421|timeout|connect|reset|closed|unavailable/i
```

**Key features:**
- Generic `retryAsync` with configurable attempts, delays, jitter
- Policy-specific retry envelopes (channel API, provider requests, etc.)
- `shouldRetry` predicates + `retryAfterMs` hooks (respects Retry-After headers)
- `onRetry` callback for logging/monitoring
- Retry budget tracking per operation type
- Fallback state tracking for auto-reply degradation

### Odysseus

**Architecture:** Ad-hoc error handling in agent loop.

**Key patterns:**
- Tool timeout: 60s per tool, 10K char output limit
- "After tool fails, do not go silent"; agent rules enforce follow-up
- Rate limiter (`src/rate_limiter.py`); per-user, per-endpoint
- Connection retry in LLM core
- No formal retry policy framework

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Retry framework | Adapter-specific | Generic retryAsync | Ad-hoc |
| Context overflow | Auto-compress + retry | Configurable | Manual compaction |
| Fallback chain | Provider chain | Provider chain | Single endpoint |
| Rate limiting | Provider-level | Channel-level | Per-user/endpoint |
| Jitter | Implicit | Explicit 0.1 | None |
| Error classification | Done:  Per-adapter | Done:  Regex patterns | Minimal |

---

## 6. CONTEXT MANAGEMENT

### Hermes Agent

**Context Compressor** (`agent/context_compressor.py`; 2426 lines):

**Key features:**
- Uses auxiliary model (cheap/fast) to summarize middle turns
- Protects head (system prompt) and tail (recent messages) context
- Token-budget tail protection (not fixed message count)
- Structured summary template: Resolved/Pending questions, In-Progress state, Remaining Work
- Iterative summary updates (preserves info across multiple compactions)
- Tool output pruning before LLM summarization (cheap pre-pass)
- Historical headings: "Historical Task Snapshot", "Historical In-Progress State", "Historical Pending Asks", "Historical Remaining Work"
- Summary prefix explicitly warns: "REFERENCE ONLY; do NOT answer or fulfill requests from this summary"
- Scaled summary budget proportional to compressed content

**Summary prefix (critical design element):**
```
[CONTEXT COMPACTION; REFERENCE ONLY] Earlier turns were compacted
into the summary below. Do NOT answer questions or fulfill requests
mentioned in this summary; they were already addressed. Respond ONLY
to the latest user message. Topic overlap does NOT mean resume.
```

### OpenClaw

**Context management:** Bootstrap file injection with size limits + truncation.

**Key features:**
- Bootstrap file limits: `bootstrapMaxChars` (default 20000 per file), `bootstrapTotalMaxChars` (default 60000 total)
- Truncation warning injection (off/once/always)
- Workspace files injected above cache boundary (stable)
- Channel/session sections below cache boundary (volatile)
- Context treemap for visualization
- Post-compaction context refresh
- For Codex harness: avoids repeating workspace files in every turn (Codex loads them via project-doc discovery)

### Odysseus

**Context Compactor** (`src/context_compactor.py`; 456 lines):

**Key features:**
- Triggers at 85% of context window
- Uses same LLM for self-summarization (no auxiliary model)
- Cursor-style structured summary prompt
- Small context models (≤8192 tokens) get aggressive trimming
- Orphaned tool message cleanup (removes dangling tool messages after trim)
- Self-summary system prompt with structured format: User Goal, What Was Done, Current State, Pending/Next Steps, Key Context

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Compaction model | Auxiliary LLM | Bootstrap limits + truncation | Same LLM self-summary |
| Trigger | Context overflow error | Configurable limits | 85% of context window |
| Historical protection | Done:  Explicit prefix warning | Implicit via truncation | Structured summary |
| Iterative summaries | Done:  Preserves across compactions | N/A | Single pass |
| Tool output pruning | Done:  Pre-pass | N/A | Orphan cleanup |
| Summary budget | Proportional | Fixed char limits | 1000 token max |

---

## 7. PLUGIN & EXTENSION SYSTEMS

### Hermes Agent

**Architecture:** Plugin directory + auto-discovery. Plugins live in `~/.hermes/plugins/` or `plugins/` in the repo.

**Plugin categories:**
```
plugins/
├── memory/; 8 memory providers
├── context_engine/; context engine plugins
├── model-providers/; inference backends
├── kanban/; multi-agent board
├── hermes-achievements/; gamification
├── observability/; metrics/traces/logs
├── image_gen/; image generation
├── video_gen/; video generation
├── browser/; browser automation
├── disk-cleanup/; maintenance
├── google_meet/; meeting integration
├── platforms/; additional channel platforms
├── security-guidance/; security recommendations
├── spotify/; music control
└── teams_pipeline/; Teams meeting pipeline
```

**Key design:**
- "Core is a narrow waist; capability lives at the edges"
- Plugins work within ABCs/hooks provided by core
- If a plugin needs more, widen the generic plugin surface; don't special-case in core
- Plugin-bundled skills eligible only when owning plugin is enabled

### OpenClaw

**Architecture:** Extension-based with formal Plugin SDK.

**Directory:** `extensions/` (50+ extensions)

**Plugin SDK** (`src/plugin-sdk/`; 20+ surface files):
```
plugin-sdk/
├── acp-runtime-backend.ts
├── memory-core-host-engine-foundation.ts
├── config-types.ts
├── command-status.ts
├── inbound-reply-dispatch.ts
├── channel-logging.ts
├── memory-core-host-runtime-files.ts
├── browser-config.ts
├── runtime-group-policy.ts
├── agent-media-payload.ts
├── skills-runtime.ts
├── secure-random-runtime.ts
├── video-generation.ts
├── codex-mcp-projection.ts
├── fetch-runtime.ts
├── secret-input-schema.ts
└── markdown-table-runtime.ts
```

**Key design:**
- Core stays plugin-agnostic. No bundled ids/defaults/policy in core.
- Plugins cross into core only via SDK, manifest metadata, injected runtime helpers
- Plugin prod code: no core `src/**`, no `src/plugin-sdk-internal/**`, no other plugin `src/**`
- External plugins own package/deps; excluded from core dist
- Bundled plugins ship in core dist

### Odysseus

**Architecture:** Integrations system + MCP servers. No formal plugin SDK.

**Integrations** (`src/integrations.py`):
- ~20 built-in integrations
- API-based: each integration is an API endpoint configuration
- Encrypted secret storage
- Prompt injection: `get_integrations_prompt()` describes enabled integrations in system prompt

**MCP Servers** (`mcp_servers/`):
- Built-in MCP server directory
- `mcp_manager.py` manages MCP connections
- Tool discovery from MCP servers
- Cached tool descriptions for prompt injection

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Plugin format | Python packages + hooks | TypeScript extensions + SDK | Integrations + MCP |
| SDK surface | Plugin hooks (ABCs) | 20+ formal SDK modules | None (API-based) |
| Discovery | Auto-discovery at startup | Manifest + registry | API registration |
| Core isolation | "Narrow waist" principle | Strict: no core imports from plugins | No formal boundary |
| Bundled plugins | 14 categories | 50+ extensions | ~20 integrations |
| Memory providers | 8 pluggable | 1 extension (memory-core) | 1 built-in |

---

## 8. CHANNEL & PLATFORM SUPPORT

### Hermes Agent

**Architecture:** Gateway with platform adapters. Each platform is a separate file.

**Supported platforms** (20+):
```
gateway/platforms/
├── telegram.py, discord.py, slack.py, whatsapp.py
├── signal.py, matrix.py, mattermost.py
├── email.py, sms.py
├── dingtalk.py, wecom.py, weixin.py, feishu.py
├── qqbot/, bluebubbles.py
├── homeassistant.py
├── webhook.py, api_server.py
└── yuanbao.py
```

**Key design:**
- Each platform adapter handles: inbound message parsing, outbound message formatting, media attachment handling
- Platform-specific formatting hints injected into system prompt
- Gateway sessions share same AIAgent core
- Operator sessions: single session key across platforms

### OpenClaw

**Architecture:** Channel system under `src/channels/`. Message access and sender identity separated.

**Key design:**
- Channels are implementation under `src/channels/**`
- Plugin authors get SDK seams
- Message/channel plugins stay transport-only
- Portable presentation/actions pattern (typed, not raw string inference)
- Channel-specific prompt sections injected below cache boundary
- Native approval cards for channel UIs that support them

### Odysseus

**Architecture:** Web-only. No multi-platform gateway.

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Platforms | 20+ adapters | 15+ channels | Web only |
| Architecture | Platform adapter files | Channel + message access | N/A |
| Formatting | Per-platform hints | Portable presentation actions | N/A |
| Cross-platform sessions | Operator sessions | Session keys | N/A |
| Approval UI | Per-platform | Native approval cards | N/A |

---

## 9. PROVIDER & MODEL MANAGEMENT

### Hermes Agent

**Architecture:** Provider adapters + endpoint routing.

**Provider adapters** (in `agent/`):
- `bedrock_adapter.py` (2426 lines; most complex)
- OpenAI, Anthropic, Google, DeepSeek, xAI, Groq, Mistral, Cohere, Together, Fireworks, Perplexity, Ollama, GitHub Copilot, Venice, Kimi
- Custom provider support
- Model metadata: context lengths, capabilities, pricing
- Image routing: multimodal model detection, image part management
- Streaming: SSE parsing per provider
- Reasoning content extraction (DeepSeek R1, Claude extended thinking)

**Key design:**
- Provider adapters handle: auth, request formatting, response parsing, streaming, error classification
- Model-family-specific operational guidance injected into system prompt
- Provider selection: explicit or fallback chain
- Context length detection per model
- Runtime provider system for custom/non-native providers

### OpenClaw

**Architecture:** Provider plugins with config-driven selection.

**Key design:**
- Provider plugins contribute: auth, model catalog, runtime hooks, prompt overlays
- Provider prompt contributions: stable prefix, dynamic suffix, section replacements
- Config-driven model selection with aliases
- Multi-provider credential management

### Odysseus

**Architecture:** Endpoint-based. Single endpoint configuration.

**Key design:**
- Endpoint resolver: maps model names to base URLs
- Supports OpenAI-compatible endpoints + Ollama
- Native tool calling detection: host-based (`_API_HOSTS` frozenset)
- Model context length: configurable per endpoint
- Copilot integration: GitHub Copilot API support
- No formal provider adapter system

### Comparison

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Provider adapters | 15+ formal adapters | Plugin-based providers | Endpoint config |
| Error classification | Done:  Per-adapter | Done:  Regex + policy | Minimal |
| Model metadata | Context length, pricing, capabilities | Provider catalog | Manual config |
| Fallback chain | Done:  Configurable | Done:  Configurable | Single endpoint |
| Custom providers | Done:  Runtime provider system | Plugin SDK | URL-based |
| Prompt overlays | Model-family guidance | Provider sections | None |

---

## 10. WHAT KARINA SHOULD ADOPT

### From Hermes Agent

1. **Tool Use Enforcement**; "MUST use tools, don't describe plans" block
2. **Anti-Fabrication Rule**; "NEVER invent results, report blockers honestly"
3. **Context Compaction with Warning Prefix**; The "REFERENCE ONLY; do not resume" pattern is the single most important context management innovation. Prevents compaction-induced task resurrection.
4. **Subagent Architecture**; Two modes (single/batch), two roles (leaf/orchestrator), blocked tools list, ThreadPoolExecutor with TLS approval callbacks
5. **Memory Discipline**; Declarative facts, no stale artifacts, no instructions-to-self
6. **Mandatory Tool List**; 7 categories where memory answers are forbidden
7. **Registry-based Tool Discovery**; Auto-discovery with minimal boilerplate

### From OpenClaw

8. **SOUL.md + IDENTITY.md**; Separate personality (voice) from self-definition (identity)
9. **Plugin SDK**; Formal extension surface with typed contracts
10. **Retry Infrastructure**; Generic retryAsync with configurable policies, jitter, Retry-After respect
11. **Bootstrap File System**; AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, MEMORY.md loaded from workspace
12. **Memory Dreaming**; Automatic background consolidation of daily notes into curated summary
13. **Push-Based Completion Wake**; Subagents/background tasks notify on completion instead of polling
14. **PromptMode Minimal**; Subagents get stripped prompt (no memory, identity, messaging)

### From Odysseus

15. **Three-Turn-End Model**; DONE/BLOCKED/KEEP GOING eliminates trailing off
16. **Bias Toward Action**; "JUST DO IT, don't clarify minor ambiguity"
17. **Fail-Silent Prevention**; "After tool fails, DO NOT GO SILENT"
18. **Casual Message Handling**; "test/yo/thanks → answer normally, no tools"
19. **Tool Security Model**; Clear admin/non-admin split with plan mode allowlist
20. **UI Anchors**; Clickable entity references in responses (`[Name](#session-<id>)`)
21. **Domain Rule Packs**; Load tool-specific guidance only when those tools are enabled
22. **Embedding-Based Tool Selection**; For running on smaller models, select relevant tools instead of sending all

---

## 11. IMPLEMENTATION PRIORITIES

### PHASE 1; Immediate (this week)
**Impact: Fixes 80% of Karina's behavioral issues**

1. Inject tool-use enforcement + anti-fabrication blocks (from Hermes)
2. Inject three-turn-end model + bias toward action (from Odysseus)
3. Inject fail-silent prevention (from Odysseus)
4. Inject casual message handling (from Odysseus)
5. Inject mandatory tool list (from Hermes)
6. Inject memory discipline (from Hermes)

### PHASE 2; Personality (when IDENTITY is ready)
**Impact: Gives Karina a distinct voice**

7. Create IDENTITY.md + SOUL.md (OpenClaw format)
8. Inject SOUL philosophy (opinions, no filler, brevity, calling out bad ideas)

### PHASE 3; Infrastructure (next 2 weeks)
**Impact: Makes Karina more robust**

9. Implement retry infrastructure (OpenClaw pattern)
10. Implement context compaction with warning prefix (Hermes pattern)
11. Separate stable/context/volatile system prompt tiers (Hermes pattern)
12. Create bootstrap file system: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, MEMORY.md

### PHASE 4; Subagents (next sprint)
**Impact: Enables parallel task execution**

13. Implement subagent architecture (Hermes pattern)
14. Two modes (single/batch), two roles (leaf/orchestrator)
15. Blocked tools list for subagents
16. promptMode=minimal for subagent context

### PHASE 5; Platform (future)
**Impact: Production-grade multi-platform support**

17. Plugin/extension SDK (OpenClaw pattern)
18. Domain rule packs (Odysseus pattern)
19. Memory dreaming/consolidation (OpenClaw pattern)
20. Embedding-based tool selection for small models (Odysseus pattern)

---

## NOTES

- Karina's current architecture is closest to Odysseus (single-agent, web-focused, simpler memory)
- Hermes' context compaction with warning prefix is the single most impactful feature to adopt; prevents the most common Karina failure mode (resurrecting old tasks after compaction)
- OpenClaw's Plugin SDK is overengineered for Karina's current scope but the pattern (formal extension surface) is worth adopting long-term
- Odysseus' tool security model (admin/non-admin + plan mode allowlist) is the simplest to implement and immediately useful
- All three agents agree on one thing: **the agent must NEVER fabricate results and must ALWAYS use tools for factual questions**; this should be Karina's first and most prominent system prompt rule
