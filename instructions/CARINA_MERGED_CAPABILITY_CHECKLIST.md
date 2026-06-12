# Carina Merged Capability Checklist

Living inventory tracking the merge of Hermes + OpenClaw capabilities into standalone Carina.

Status: `[ ]` not started  `[~]` in progress / partial  `[x]` complete  `[—]` intentionally out of scope

**Last updated:** 12 June 2026  
**Current phase:** Phase 10 — Docs + public release (**~85% complete**)

---

## Audit summary (12 June 2026)

Repo audit against this checklist. Do not assume missing if built under another name.

| Area | Checklist said | Actual status | Notes |
|---|---|---|---|
| Provider catalog | 41 / 31 routable | **51 catalog / ~39 routable** | `provider-registry.ts` + plugin overrides |
| Free Copilot | in progress | **built** | `provider-routing.ts`, `CARINA_LLM_PRESET=free-copilot` |
| BytePlus, Tencent, Volcengine, LiteLLM | marked [x] before audit | **built** (added 12 Jun) | Were false positives; now in registry |
| Vertex, Cloudflare Gateway, SGLang, Bedrock Mantle | [ ] | **built** (experimental) | Added 12 Jun |
| Voyage embeddings | [ ] | **partial** | Catalog entry (`unsupported`); not wired to chat router |
| Channels (Signal, Matrix, etc.) | [ ] | **partial** | Adapters exist; opt-in via env flags |
| DM pairing, thread ownership, directory | [ ] | **partial** | Built behind flags; not default-on |
| Node host / device pairing | [ ] | **partial** | HTTP poll daemon; not WebSocket |
| TaskFlows | [ ] | **partial (~75%)** | `ops/taskflows/`; cron + webhook triggers; background worker opt-in |
| Session memory (SQLite FTS5) | [ ] | **partial** | Postgres tsvector search exists; not SQLite FTS5 |
| Persistent memory injection | [ ] | **partial** | `memory/persistent-memory.ts` + turn injection |
| Debug proxy | [ ] | **partial (~70%)** | Passthrough provider routing opt-in; capture/purge CLI |
| ACP bridge | [ ] | **partial (~60%)** | `gateway/acp.ts`, sessions, auth, provenance; env-gated |
| Mobile companion | `mobile/` | **partial** | `carinaMobile/` with push + offline queue |
| On-chain trust [x] in core | [x] | **partial** | Implementation in `console.labyrinthscout.com/src/trust/` |
| Hosted free daily cap | assumed config | **fixed 12 Jun** | `hosted-billing.ts` now uses `config.hosted.freeDailyMessages` |
| Public SOC2 claims | enterprise plan | **qualified 12 Jun** | Readiness export wording; not third-party attestation |
| Capability inventory (public) | scattered | **canonical 12 Jun** | `docs.carinaai.uk/docs/user/capability-inventory.md` slug `/capabilities` |
| Mobile companion parity | partial shell | **wired 12 Jun** | Cloud gating, session persistence, native capability honesty |

**Naming aliases**

| Checklist term | Repo path / command |
|---|---|
| `/memories` CLI | `carina memory` |
| `carina qr` | `carina pairing qr` |
| Doctor `--fix` | `carina doctor --repair` |
| `carina plugins` | also `carina extensions` |
| Mobile app | `carinaMobile/` |

---

## Gap map — first closable batch

Items that can be closed next without touching the live chat hot path:

| Priority | Item | Effort | Dependency |
|---|---|---|---|
| 1 | Voyage embeddings wired to RAG ingest | small | none |
| 2 | Reasoning effort capability tag on providers | small | none |
| 3 | Streaming compatibility matrix doc | small | none |
| 4 | Unified auth profiles CLI polish | medium | credentials-cli exists |
| 5 | Channel setup guides (docs site) | medium | adapters exist |
| 6 | WhatsApp bridge harden + default-off docs | medium | Baileys exists |
| 7 | Session memory: document Postgres path vs SQLite FTS5 goal | small | none |
| 8 | Migration guide (Hermes / OpenClaw) on docs site | medium | migrate CLI exists |

---

## Implementation plan (ordered by impact)

### Now complete — Phase 1
- Data-driven provider registry with auth, cost, status, transport tags
- Free Copilot preset (local → operator-free → tagged-free → cheapest)
- Sync health cache + opt-in probe (`carina providers health probe`)
- CLI/TUI catalog (`carina providers list`, `/provider`, `/copilot`)
- Tests: registry, catalog, routing, latency guard (no probe on chat path)

### Phase 2 — Channel breadth (in progress ~75%)
1. ~~Honest channel status for all adapters~~ (`channel-status.ts` + `carina channels status`)
2. ~~Thread ownership + DM pairing enforcement~~ (opt-in flags; audit logs)
3. ~~WhatsApp explicit enablement path~~ (`carina whatsapp setup|status`, self-bridge reporting)
4. ~~Channel routing metadata~~ (`channel-routing.ts`, peer scoping opt-in)
5. Channel health dashboard in ops panel (CLI done; ops UI pending)
6. Production operator docs for channel flags

### Phase 3 — Node host, sandbox, approvals (in progress ~80%)
1. ~~Node host daemon + HTTP poll transport~~
2. ~~Pairing approve/reject/revoke/rotate (nodes + devices)~~
3. ~~File transfer with path allowlist + size limits~~
4. ~~Sandbox create/list/recreate/teardown/explain~~
5. ~~Approval store + CLI + tool-runner integration~~
6. Systemd lifecycle wired in CLI (Linux user unit)
7. Ops control push/pull for file transfer
8. Unix socket approval daemon (deferred; file store sufficient for now)
9. Node WebSocket transport (deferred)
10. Ops panel control dashboard (CLI done)

### Phase 4 — Memory fabric
1. Decide: keep Postgres session search vs port SQLite FTS5
2. Expand persistent memory budgets + cross-session fact durability

### Phase 5+ — see Suggested Build Order below

---

## 1. Providers

### 1.1 Core provider plugins (already in Carina)
- [x] Anthropic (`@anthropic-ai/sdk`)
- [x] Google (`@google/generative-ai`)
- [x] OpenAI (`openai`)

### 1.2 Provider plugin system (port from OpenClaw)
- [x] Plugin loader architecture (`src/plugins/loader.ts`, auto-load at CLI startup)
- [x] Provider interface spec (`ProviderDefinition`, `ProviderPlugin`, transport/auth types)
- [x] Plugin enable/disable per provider (`carina providers disable|enable`)
- [~] Provider auth profile management (credential pools + OAuth device flow; no unified auth profiles UI)
- [x] Merge-mode provider resolution (`mergeFallbackOrder` in `provider-routing.ts`)

### 1.3 Provider breadth — 30+ backends
Catalog: **51 providers**, **~39 routable** in `provider-registry.ts` (June 2026).

- [x] DeepSeek
- [x] Groq
- [x] Cerebras
- [x] Together AI
- [x] Fireworks
- [x] Mistral
- [x] Cohere
- [x] xAI / Grok
- [x] Perplexity
- [x] OpenRouter
- [x] Ollama (local)
- [x] vLLM (self-hosted)
- [x] LiteLLM (proxy)
- [x] LM Studio (local)
- [x] SGLang (local)
- [x] GitHub Copilot API plugin (`plugins/providers/github-copilot.ts`)
- [x] Amazon Bedrock (catalog entry; needs `BEDROCK_BASE_URL`)
- [x] Amazon Bedrock Mantle (experimental; needs proxy URL)
- [x] Google Vertex AI (experimental; needs `VERTEX_BASE_URL`)
- [x] Cloudflare AI Gateway (experimental)
- [x] Alibaba / Qwen
- [x] Moonshot / Kimi (alias)
- [x] Zhipu / GLM (alias)
- [x] BytePlus
- [x] Tencent (accepts `HUNYUAN_API_KEY` alias)
- [x] Volcengine
- [x] NVIDIA NIM
- [x] HuggingFace Inference
- [~] Voyage (embeddings) — catalog entry only; not chat-routable yet

### 1.4 Provider features
- [x] Provider health checks (`provider-health.ts`, `carina providers health`)
- [x] Provider routing (tags, fallback chains, Free Copilot preset)
- [x] Model discovery (`carina providers scan`, alias `carina model scan`)
- [x] Cost tracking per provider (usdPerToken tags + `/usage`)
- [ ] Reasoning effort support detection
- [~] Streaming compatibility matrix (per-provider capabilities in `providers info`; no full matrix doc)

---

## 2. Channels and Thread Ownership

### 2.1 Channel plugins (port from OpenClaw)
- [x] Telegram
- [x] Discord
- [x] Slack
- [x] Web
- [x] CLI / TUI
- [x] WhatsApp — Baileys bridge + Twilio; explicit `carina whatsapp setup`; off by default
- [x] Signal — adapter + webhook/poll; opt-in via env
- [x] iMessage / BlueBubbles — REST adapter; operator-controlled macOS bridge
- [x] Matrix — adapter + `/sync` or webhook; opt-in via env
- [~] IRC — sidecar contract (`POST /webhooks/irc`); no live core client
- [x] Mattermost — webhook in + bot API out; opt-in via env

### 2.2 Channel management
- [x] Channel registry adapter pattern (`channel-registry.ts`)
- [x] Directory lookup per channel (`directory.ts`, `carina channels directory`)
- [x] DM pairing — approve/reject/revoke/rotate (`dm-pairing.ts`; `CARINA_CHANNEL_DM_PAIRING=true`)
- [~] Session DM scope (peer scoping opt-in via `CARINA_CHANNEL_PEER_SCOPING=true`)
- [x] Thread ownership — Slack/Discord/Telegram/WhatsApp/Matrix/Mattermost/IRC/Signal/iMessage (`thread-ownership.ts`)
- [x] Channel health status CLI (`carina channels status`, policy flags)

---

## 3. Node Host and Device Pairing

### 3.1 Node host architecture
- [x] Node host daemon (`infrastructure/node-host/daemon.ts`; HTTP poll)
- [~] OS service management (systemd via `carina node-host install|start|stop`; no launchd/schtasks)
- [ ] Node ↔ Gateway WebSocket connection
- [x] File transfer to/from nodes (path allowlist, `carina ops control push|pull`)
- [x] Node command deny list (`security/node-command-policy.ts`)
- [ ] Container mode (`--container` flag)

### 3.2 Device pairing
- [x] Device token management (`device-pairing.ts`, rotate/revoke)
- [~] QR code mobile pairing (`carina pairing qr`; terminal payload)
- [x] Pending device approval queue (nodes + mobile)
- [ ] Device role-based access control
- [ ] Phone control

---

## 4. Sandbox and Approvals

### 4.1 Sandbox containers
- [x] Docker sandbox backend (`tools/sandbox.ts`, `ops/sandbox-containers.ts`)
- [ ] OpenShell sandbox backend
- [~] Per-session sandbox allocation (`CARINA_SANDBOX_SESSION=true`)
- [ ] Per-agent sandbox configuration
- [x] Sandbox lifecycle CLI (`carina ops sandbox create|list|recreate|teardown|explain`)
- [~] Browser sandbox (Playwright exists; not per-session isolated)

### 4.2 Exec approvals
- [ ] Unix socket-based approval daemon
- [x] Per-agent/profile approval policies (`approval-policy.ts`, `approvals-cli.ts`)
- [x] Auto-expiry on approvals (grants + remember TTL)
- [x] Approval request/reject/audit log (file store)
- [x] Dangerous command pattern detection (shared with node shell policy)

---

## 5. Plugin Ecosystem

### 5.1 Plugin system
- [x] Provider plugin loader (`plugins/providers/*.ts`)
- [x] Extension bundle manifest (`extension.json` v1: id, version, author, entryPoints, capabilities, dependencies, eval, risk, safety, `minCarinaVersion`)
- [x] Extension lifecycle CLI (`carina extensions install|list|enable|disable|remove|rollback|validate|status`; `carina plugins` alias)
- [x] Validation before enable (entry paths, sensitive scan, high-risk gate, semver compat)
- [x] Offline eval gate (`CARINA_EVAL_GATE`, `--bypass-eval`; reuses skills eval runner)
- [x] Runtime integration (tools → `registry`, skills/prompts/RAG → staged resources; no duplicate registry)
- [x] Hot reload when `CARINA_EXTENSIONS_ENABLED=true` (enable/disable updates live tools/prompts)
- [~] Plugin store / registry (Skills Hub + local extension bundles; no ClawHub-style marketplace)
- [x] Plugin state isolation (extensions opt-in via `CARINA_EXTENSIONS_ENABLED`; latency guard tests)
- [~] MCP / hooks capability loaders (manifest + validation warn; runtime loaders pending)

### 5.2 Ported OpenClaw plugins (non-provider, non-channel)
- [ ] Active Memory
- [ ] Document Extraction
- [ ] Web Readability
- [ ] File Transfer
- [ ] Phone Control
- [ ] Bonjour Gateway Discovery
- [ ] Tokenjuice
- [ ] Memory Wiki
- [ ] Skill Workshop
- [ ] LLM Task

---

## 6. TaskFlows / Cron / Kanban

### 6.1 Cron system
- [x] Basic cron scheduler (`agents/cron-scheduler.ts`)
- [ ] Per-job model overrides
- [~] Per-job toolset restrictions (`enabledToolsets` in schema)
- [ ] Profile isolation per job
- [~] `context_from` job chains
- [~] `no_agent` watchdogs
- [~] Delivery targeting: platform:chat_id:thread_id (`cron-delivery.ts`)
- [~] Job state inspection (`carina cron` partial)
- [ ] Job output history with search

### 6.2 TaskFlows
- [x] Durable workflow registry (`ops/taskflows/store.ts`; JSON file store)
- [x] Step types: agent, delay, webhook, cron job, tool
- [x] Run states: queued, running, succeeded, failed, timed_out, cancelled, lost
- [x] Webhook-triggered flows (`CARINA_TASKFLOWS_WEBHOOK_HOOK`)
- [x] Cron job-triggered flows (`triggerTaskFlowsForCronJob` from cron scheduler)
- [x] Background worker loop opt-in (`CARINA_TASKFLOWS_WORKER_INTERVAL_MS`)
- [x] CLI inspection (`carina taskflows`, `carina tasks`)
- [ ] TaskFlow definition language (YAML/DSL)
- [ ] Sub-agent-triggered flows
- [ ] Flow retry and resume from failed step
- [ ] Enable by default when stable

### 6.3 Kanban
- [x] Kanban board data model (`carina kanban` CLI, `agents/kanban-store.ts`)
- [ ] Worker pool management
- [ ] Task decomposition into kanban items
- [ ] Parallel lane execution
- [ ] Worker ↔ orchestrator feedback loop

---

## 7. Memory Fabric

### 7.1 Long-term memory (Carina)
- [x] PostgreSQL + pgvector
- [x] Episodic memory store
- [x] `/memories` CLI commands (`carina memory`)

### 7.2 Session memory (from Hermes)
- [x] Postgres tsvector session search (`session-index.ts`, `session-search` tool)
- [x] Session discovery CLI (`carina memory sessions browse|search`)
- [~] Cross-session semantic search (episodic vector search + session FTS)
- [ ] Session scrolling / lineage tracking

### 7.3 Persistent user/agent memory (from Hermes)
- [x] Durable memory store with budgets (`persistent-memory.ts`)
- [x] Cap-aware trim + duplicate detection (`carina memory consolidate`, `carina memory budget`)
- [x] Configurable memory injection (`CARINA_MEMORY_INJECTION=off|minimal|full`)
- [x] Memory injection into turns (bounded; skipped in fast mode)
- [x] REM auto-promote opt-out (`CARINA_REM_ENABLED=false`)
- [ ] Separate user profile / agent memory stores (single `persistent_facts` table today)

### 7.4 Workspace memory (from OpenClaw)
- [~] File-based workspace (SKILL.md, user resources)
- [ ] Workspace file watcher
- [x] Agent sync protocol (`sync/agent-sync.ts`)
- [~] OpenClaw workspace import path (`migrate-cli.ts` partial)

---

## 8. Skills and Skill Packs

### 8.1 Skill system
- [x] Domain skill packs (16 builtin)
- [x] Skill auto-loader from packs directory
- [x] Skill curator scheduler + duplicate detection (`carina curator duplicates`)
- [x] Pack lifecycle CLI (`carina packs list|status|enable|disable|install|remove`)
- [x] Skill workshop review queue (`carina workshop`, `CARINA_SKILL_WORKSHOP=true`)
- [x] Hub publish (`carina hub publish <pack-dir>`)
- [~] Skill validation and linting (Hub validate on publish; no `carina skills lint`)
- [~] Skill marketplace (Skills Hub browse/install; community publish via CLI)
- [x] Operator pack store
- [x] Skill evaluation harness (`skills/eval/`)
- [x] Skill auto-writing opt-out (`SKILL_AUTO_WRITE=false`; workshop queues when enabled)

---

## 9. Migration and Interop

### 9.1 State import
- [x] Hermes migration (`carina migrate hermes`; partial skills labeled)
- [x] OpenClaw migration (`carina migrate openclaw`; skills partial, warnings)
- [x] Claude Code / Claude Desktop migration (`carina migrate claude`; redaction + MCP metadata)
- [x] Generic agent import/export (`carina migrate export|import`)
- [x] Pre-migration auto-backup (unless `--no-backup`)
- [ ] Full OpenClaw production import (skills not pack-converted)

### 9.2 State export
- [x] Profile export (`carina profile export`)
- [x] Full state export archive (`interop-bundle.ts`)
- [ ] Selective export

---

## 10. Backup / Doctor / Secrets / Reset

### 10.1 Backup
- [x] Backup CLI (`carina backup list|create|archive|plan|restore|verify`)
- [x] Ops backup parity (`carina ops backup` with plan/force/dry-run/json)
- [x] Manifest with sha256 verification + optional postgres dump
- [x] Safe restore with overwrite warnings (`--force`, `plan`)

### 10.2 Doctor
- [x] Structured health checks (`carina doctor [--json] [--quiet]`)
- [x] Auto-repair: mkdir home, chmod .env, config migrate, approval prune, secrets review artifact
- [ ] Deep scan / gateway token generation
- [x] Scripting mode (`--json`, `--quiet`)

### 10.3 Secrets
- [x] Secrets audit + precedence drift (`carina secrets audit`)
- [x] Interactive review (`carina secrets review`)
- [x] Doctor repair writes `doctor-secrets-review.json`
- [ ] Secrets plan apply/rollback
- [~] Credential encryption at rest (hosted tenants)

### 10.4 Reset
- [~] Config reset (`reset-cli.ts`, scopes soft/state/full)
- [~] Partial reset
- [ ] Dev profile isolation (`--dev` flag)

---

## 11. Observability and Debug Proxy

### 11.1 Observability
- [x] Labyrinth Scout heartbeat and metrics
- [x] Turn logging with bucket classification
- [x] Cost tracking per provider per month
- [ ] Gateway log streaming via RPC / WebSocket
- [ ] System events with presence tracking
- [~] Channel health dashboard (CLI only)
- [ ] Agent session status overview

### 11.2 Debug proxy
- [x] HTTP reverse proxy (`ops/debug-proxy.ts`, `carina ops proxy`)
- [x] Provider passthrough URLs (`/https://api.openai.com/...`)
- [x] Opt-in LLM routing (`CARINA_DEBUG_PROXY_ROUTING` + provider filter)
- [x] Request/response capture by ID (`debug-proxy-capture.ts`)
- [x] Payload preview + redaction
- [x] Captured data purging
- [x] Per-provider capture filter (`CARINA_DEBUG_PROXY_PROVIDERS`)
- [~] Transport coverage reporting (extensibility status shows routing on/off)

### 11.3 ACP
- [x] ACP bridge gateway routes (`gateway/acp.ts`, `/acp/*`)
- [x] Session store with labels (`infrastructure/acp-bridge/store.ts`)
- [x] Password file auth (`CARINA_ACP_PASSWORD_FILE`)
- [x] Provenance modes (relaxed/strict via `CARINA_ACP_PROVENANCE`)
- [x] CLI bridge + prompt (`carina acp`)
- [~] Client vs bridge vs server mode (reported; server-side behavior shared)
- [ ] ACP standard compliance validation
- [ ] IDE route integration tests

---

## 12. Security / Trust

### 12.1 Runtime security
- [x] Prompt injection guard
- [x] Tool output scanning
- [x] Agent output scanning
- [x] Kill switch listener
- [x] Tool policy enforcement
- [x] Egress filter
- [x] Honeypot
- [ ] Sandbox container integration with tool policy
- [~] Exec approval integration with tool policy

### 12.2 On-chain trust
- [~] ERC-8004 agent identity registration (Scout: `console.labyrinthscout.com/src/trust/`)
- [~] ERC-8126 security attestation (Scout)
- [~] Trust dashboard (Scout)
- [ ] Automated attestation on critical events
- [~] Attestation verification API (Scout: `/api/public/trust/verify`)

### 12.3 Auth and access
- [x] Hosted SaaS auth
- [x] Web auth middleware
- [~] API key / token management (`carina credentials`, ops token)
- [~] Tenant-level provider overrides (`tenant-provider-keys.ts`)
- [ ] Role-based access control for tools

---

## 13. Billing / Tenancy

### 13.1 Billing
- [x] Stripe subscription integration
- [x] Tiered plans
- [x] Pricing page with checkout
- [x] Billing webhooks
- [ ] Usage-based billing
- [~] Free tier with provider limits (daily message quota enforced on hosted chat; token metering module present)
- [ ] Team/workspace billing

### 13.2 Tenancy
- [x] Multi-tenant hosted accounts
- [x] Operator isolation
- [x] Profile scoping
- [~] Tenant-level provider configuration
- [ ] Tenant-level skill pack enable/disable
- [ ] Tenant-level channel configuration

---

## 14. Mobile

### 14.1 Mobile companion
- [x] React Native / Expo app (`carinaMobile/`)
- [x] Chat stream + session persistence (`useChatSession`, `instance-store`)
- [x] Trust dashboard (public Scout feed + hosted Scout when cloud)
- [x] Memory and packs gated to Carina Cloud (`CloudFeatureGate`)
- [x] Usage/billing screen for cloud accounts
- [~] Mobile pairing via QR code (core API; mobile uses instance URL today)
- [x] Mobile push notifications (EAS build + real project ID required)
- [x] Mobile voice note delivery (native build; Expo Go blocked with reason)
- [x] Mobile offline queue
- [x] Native capability gating (`native-capabilities.ts`, More tab copy)

### 14.2 Phone as node
- [ ] Phone control integration
- [ ] Phone presence / heartbeat
- [ ] Phone file access

---

## 15. Docs and Public Release Readiness

### 15.1 Documentation
- [~] CLI reference (`carina help`; per-command usage strings)
- [~] Provider configuration guide (`.env.example`, `providers info`)
- [ ] Channel setup guide per platform
- [x] Skill pack authoring guide (`docs/skill-packs/creating-packs.md`)
- [~] Plugin development guide (`plugins/providers/github-copilot.ts` as reference)
- [~] API reference (MCP server mode shipped)
- [x] Self-hosting guide (`docs/self-hosting.md`)
- [x] Canonical capability inventory (`docs.carinaai.uk/docs/user/capability-inventory.md`, slug `/capabilities`)
- [ ] Migration guide (from Hermes, from OpenClaw)

### 15.2 Public release
- [x] npm publish pipeline (`scripts/publish-carina-agent.sh`, `RELEASE_CHECKLIST.md`)
- [ ] Changelog generation
- [ ] Versioning policy
- [ ] Breaking change policy
- [x] Docker image
- [x] One-line install script (`install.sh`)
- [ ] Homebrew formula
- [~] Landing page update (carinaai.uk)

---

## Suggested Build Order

### Phase 1: Provider Breadth + Free Copilot — COMPLETE
- [x] Plugin loader architecture
- [x] Provider plugin interface
- [x] GitHub Copilot provider plugin
- [x] DeepSeek, Groq, Cerebras, Together, Fireworks batch
- [x] OpenRouter
- [x] Ollama + vLLM + LM Studio + SGLang + LiteLLM
- [x] BytePlus, Tencent, Volcengine
- [x] Vertex AI, Cloudflare AI Gateway, Bedrock Mantle (experimental)
- [x] Provider enable/disable + model discovery CLI
- [x] Free Copilot preset + health-aware fallback
- [~] Voyage embeddings (catalog only)
- [ ] Reasoning effort detection
- [ ] Streaming compatibility matrix doc

**CLI quick reference (Phase 1):**
```bash
carina providers list
carina providers info deepseek
carina providers plugins
carina providers scan
carina providers copilot
carina model preset free-copilot
carina providers disable openai
carina providers health probe
```

### Phase 2: Channel Breadth + Thread Ownership — IN PROGRESS (~75%)
- [x] Honest status for all channel adapters (incl. dingtalk/feishu/wechat/email/api)
- [x] Thread ownership with audit log + CLI handoff/release
- [x] DM pairing with approve/reject/revoke/rotate
- [x] WhatsApp Baileys enablement + self-bridge transparency
- [x] IRC sidecar webhook contract
- [x] Channel routing metadata (`channel-routing.ts`)
- [x] Peer/thread session scoping (opt-in)
- [ ] Ops panel channel health dashboard
- [ ] Channel setup docs on docs site

**CLI quick reference (Phase 2):**
```bash
carina channels list
carina channels status
carina channels setup whatsapp
carina channels dm approve telegram <peerId>
carina channels threads list
carina channels directory lookup slack U123
carina whatsapp setup
carina whatsapp status
```

### Phase 3: Sandbox and Approvals + Node Host — IN PROGRESS (~80%)
- [x] Node host daemon + gateway poll API
- [x] Pairing lifecycle (nodes + devices)
- [x] File transfer with path policy + ops push/pull
- [x] Docker sandbox ops (create/list/recreate/teardown/explain)
- [x] Approval store + CLI + tool-runner gate
- [x] Systemd lifecycle in `carina node-host`
- [ ] WebSocket node transport
- [ ] Unix socket approval daemon
- [ ] Ops panel control UI

**CLI quick reference (Phase 3):**
```bash
carina node-host status|pair|start|stop|install
carina pairing status|approve|revoke|rotate
carina ops control status|push|pull|file-policy
carina ops sandbox status|create|teardown|explain
carina approvals list|allow|block|grant|audit
```

### Phase 4: Memory Fabric (~80%)
- [x] Episodic + semantic search + persistent facts
- [x] Session search CLI + bounded injection modes
- [x] Budget/consolidation operator commands
- [ ] SQLite FTS5 parity decision
- [ ] Session lineage / scrolling polish

### Phase 5: Node Host + Device Pairing
- [ ] Node host WebSocket transport
- [ ] QR code onboarding polish
- [ ] launchd / schtasks service templates

### Phase 6: TaskFlows + Cron Hardening (~75%)
- [x] Durable workflow registry + all run states
- [x] Webhook + cron job triggers
- [x] Background worker interval (opt-in)
- [x] Operator CLI (`carina taskflows`, `carina tasks`, `carina ops extensibility`)
- [ ] TaskFlow DSL / YAML definitions
- [ ] Flow retry/resume
- [ ] Enable by default when stable
- [ ] Kanban worker integration

### Phase 8: Observability + Debug (~70%)
- [x] Debug proxy with provider passthrough + capture/purge
- [x] Opt-in provider routing for OpenAI-compatible clients
- [~] Transport coverage in extensibility status
- [ ] Gateway log streaming
- [ ] Doctor auto-repair expansion

- [x] Extension manifest v1 + lifecycle CLI + validation/eval gate
- [x] Tool/skill/prompt/RAG integration via existing registries
- [x] Operator visibility (`carina extensions list`, TUI `/plugins`, `carina ops extensibility`)
- [ ] Full plugin marketplace (ClawHub-style; out of scope for v1)
- [~] Migration tools (Hermes, OpenClaw, Claude) docs + polish
- [ ] Utility plugins (document extraction, readability, etc.)
- [ ] MCP / hooks runtime loaders for extension bundles

### Phase 7: Plugin Ecosystem + Migration (~90% extension bundles)
- [ ] Backup/restore with verification docs
- [ ] Secrets audit wizard
- [ ] Dev profile `--dev` flag

### Phase 10: Docs + Public Release (~85%)
- [~] Full CLI reference doc site
- [ ] Channel setup guides
- [x] npm smoke install (`scripts/smoke-install.sh`, `pnpm test:smoke`)
- [x] Public capability inventory aligned with runtime help (`/docs/capabilities`)
- [x] Major guides link canonical inventory (no duplicate tool/provider lists)
- [ ] npm publish + changelog automation

---

*Track progress: change `[ ]` to `[x]` when shipped (code merged, tests pass, deployed if applicable).*
