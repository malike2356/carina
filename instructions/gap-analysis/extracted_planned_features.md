# Extracted Planned Features from Strategy Documents

Generated: 2026-06-14 | Source workspace: /opt/lampp/htdocs/verlox/carina/instructions/strategy/

Each entry below is a feature/capability/endpoint described as planned, needed, or required with unclear or incomplete implementation status. Status markers: `[ ]` not started, `[~]` partial/in-progress, `[NEED]` explicitly listed as needed/missing.

---

## 1. PROVIDER / LLM ROUTING

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 1.1 | Reasoning effort support detection on providers | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 1.2 | Streaming compatibility matrix (full doc, per-provider) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 1.3 | Voyage embeddings wired to RAG ingest (catalog only today) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 1.4 | Provider auth profile management (unified UI, OAuth device flow) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 1.5 | Switch providers mid-session | [ ] | carina_scout_empty_promises_gap.md |
| 1.6 | Per-tenant provider/model preferences and budget caps | [ ] | 4AS.md |
| 1.7 | Model switching with weighted credit system | [ ] | Carina_OP_Metering.md |
| 1.8 | Routing policy (cheap→balanced→premium→frontier escalation) | [ ] | Carina_OP_Metering.md |
| 1.9 | Per-model cost accounting (no switching without it) | [ ] | Carina_OP_Metering.md |
| 1.10 | Prompt caching support detection and billing | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 1.11 | Batch API support for async workloads | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 1.12 | Fast mode (faster output at premium pricing) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 1.13 | Advisor tool (cheap model consults strong advisor mid-task) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 1.14 | Compare models UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |

## 2. CHANNELS AND MESSAGING

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 2.1 | IRC live core client (sidecar webhook contract exists; no live client) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 2.2 | Channel health dashboard in ops panel UI (CLI done; no UI) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 2.3 | Channel setup guides per platform (docs site) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 2.4 | Session DM scope / peer scoping (opt-in; not default) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 2.5 | Multi-channel alerting (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 2.6 | WhatsApp bridge harden + default-off docs | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 2.7 | Channel credential configuration for Slack, Discord, Telegram, Twilio, email, SMS | [NEED] | CONFIGURATION_READINESS.md |

## 3. NODE HOST AND DEVICE PAIRING

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 3.1 | Node ↔ Gateway WebSocket connection (HTTP poll exists) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.2 | Container mode (`--container` flag) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.3 | OS service management for macOS (launchd) and Windows (schtasks) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.4 | Device role-based access control | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.5 | Phone control integration | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.6 | QR code mobile pairing polish (terminal payload exists) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.7 | Phone presence / heartbeat | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.8 | Phone file access | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 3.9 | Ops panel control dashboard UI (CLI done) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |

## 4. SANDBOX AND APPROVALS

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 4.1 | OpenShell sandbox backend (Docker exists) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.2 | Per-agent sandbox configuration | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.3 | Per-session sandbox allocation (opt-in flag exists) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.4 | Browser sandbox (Playwright exists; not per-session isolated) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.5 | Unix socket-based approval daemon (deferred; file store sufficient) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.6 | Exec approval integration with tool policy | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.7 | Sandbox container integration with tool policy | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 4.8 | Approval flows for risky workbench prompts (post-90-day) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |

## 5. PLUGIN ECOSYSTEM

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 5.1 | Active Memory plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.2 | Document Extraction plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.3 | Web Readability plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.4 | File Transfer plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.5 | Phone Control plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.6 | Bonjour Gateway Discovery plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.7 | Tokenjuice plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.8 | Memory Wiki plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.9 | Skill Workshop plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.10 | LLM Task plugin (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 5.11 | Full plugin marketplace (ClawHub-style; out of scope for v1) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 5.12 | MCP / hooks runtime loaders for extension bundles | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 5.13 | Plugin store / registry (more than local bundles) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 5.14 | Vertical skill packs (installable property packs) | [ ] | carina_scout_empty_promises_gap.md |

## 6. TASKFLOWS / CRON / KANBAN

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 6.1 | Per-job model overrides | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.2 | Per-job toolset restrictions (schema exists; partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.3 | Profile isolation per cron job | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.4 | `context_from` job chains (partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.5 | `no_agent` watchdogs (partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.6 | Delivery targeting (platform:chat_id:thread_id) (partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.7 | Job state inspection CLI polish (partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.8 | Job output history with search | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.9 | TaskFlow definition language (YAML/DSL) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.10 | Sub-agent-triggered flows | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.11 | Flow retry and resume from failed step | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.12 | Enable TaskFlows by default when stable | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.13 | Kanban worker pool management | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.14 | Task decomposition into kanban items | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.15 | Parallel lane execution in kanban | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.16 | Worker ↔ orchestrator feedback loop | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 6.17 | BullMQ on Redis for scheduled tasks per tenant | [ ] | 4AS.md |
| 6.18 | Batch jobs and agent session management in customer ops | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |

## 7. MEMORY FABRIC

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 7.1 | SQLite FTS5 parity decision (Postgres tsvector exists) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.2 | Session scrolling / lineage tracking | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.3 | Cross-session semantic search (episodic vector + session FTS combined) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.4 | Separate user profile / agent memory stores (single table today) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.5 | Workspace file watcher | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.6 | OpenClaw workspace import path (partial in migrate-cli) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 7.7 | Memory transparency (user view/edit not a user-facing feature) | [ ] | carina_scout_empty_promises_gap.md |
| 7.8 | Managed memory stores (Claude-style) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |

## 8. SKILLS AND SKILL PACKS

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 8.1 | Skill validation and linting (`carina skills lint`; Hub validate exists) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 8.2 | Skill marketplace (browse/install; community publish) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 8.3 | Full OpenClaw production import (skills not pack-converted) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 8.4 | Skill workshop workflow capture (OpenClaw port) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / openCLAW_features.md |
| 8.5 | Skill auto-writing opt-out polish | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 8.6 | Claude-style Skills UI in workbench | [NEED] | Carina_Ops_Claude_Platform_Compare.md |

## 9. MIGRATION AND INTEROP

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 9.1 | Full OpenClaw production import (skills not pack-converted) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 9.2 | Selective export (full archive exists) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 9.3 | Migration guide (from Hermes, from OpenClaw) on docs site | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 9.4 | Migration tools docs + polish | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 9.5 | npm installable package (listed as NOT BUILT in gap audit) | [ ] | carina_scout_empty_promises_gap.md |

## 10. BACKUP / DOCTOR / SECRETS / RESET

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 10.1 | Deep scan / gateway token generation in doctor | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.2 | Secrets plan apply/rollback | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.3 | Credential encryption at rest (hosted tenants) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.4 | Dev profile isolation (`--dev` flag) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.5 | Config reset polish (partial soft/state/full scopes) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.6 | Doctor auto-repair expansion | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.7 | Backup/restore with verification docs | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 10.8 | Secrets audit wizard | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |

## 11. OBSERVABILITY / DEBUG / ACP

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 11.1 | Gateway log streaming via RPC / WebSocket | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.2 | System events with presence tracking | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.3 | Agent session status overview | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.4 | Transport coverage reporting (partial via extensibility status) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.5 | ACP standard compliance validation | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.6 | IDE route integration tests for ACP | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.7 | Client vs bridge vs server mode clarification (ACP) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 11.8 | Analytics dashboard (Claude-style) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 11.9 | Real-time security dashboard (Scout) | [ ] | carina_scout_empty_promises_gap.md |

## 12. SECURITY / TRUST / SCOUT

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 12.1 | Automated attestation on critical events | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 12.2 | Role-based access control for tools | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 12.3 | Moving target deception (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.4 | Deception layer / honeypots (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.5 | Heuristic anomaly detection (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.6 | Tool allowlisting & rate limiting (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.7 | Full audit log & compliance (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.8 | Egress filtering & DLP (Scout) | [ ] | carina_scout_empty_promises_gap.md |
| 12.9 | Kill switch (listed as NOT BUILT in gap audit; checklist says built) | [ ] | carina_scout_empty_promises_gap.md |
| 12.10 | Deploy Scout (1-2-3 steps, self-serve) | [ ] | carina_scout_empty_promises_gap.md |
| 12.11 | Works with any agent (Scout integration) | [ ] | carina_scout_empty_promises_gap.md |
| 12.12 | Per-tenant threat isolation in Scout | [NEED] | 4AS.md |
| 12.13 | Policy packs (post-90-day) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 12.14 | Scout cross-sell integration from Carina Ops audit view | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 12.15 | Legal hold and advanced retention (post-90-day) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 12.16 | ERC-8004 on-chain trust (partial in Scout console, needs attester key config) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / CONFIGURATION_READINESS.md |
| 12.17 | ERC-8126 on-chain attestation verification (partial, needs env vars) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md / CONFIGURATION_READINESS.md |
| 12.18 | Trust dashboard (partial Scout console) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 12.19 | Attestation verification API (partial in Scout) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 12.20 | Alert delivery channel credentials (Slack, Discord, Telegram, Twilio, etc.) | [NEED] | CONFIGURATION_READINESS.md |

## 13. BILLING / METERING / TENANCY

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 13.1 | Usage-based billing (Stripe integration for metered usage) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.2 | Free tier with provider limits (daily message quota enforced on hosted) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.3 | Team/workspace billing | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.4 | Tenant-level skill pack enable/disable | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.5 | Tenant-level channel configuration | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.6 | Tenant-level provider configuration (partial) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.7 | API key / token management polish (`carina credentials`) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 13.8 | Rate card tables (ops_model_rate_cards, ops_usage_events, ops_credit_ledger, ops_routing_policies, ops_plan_entitlements, ops_usage_aggregates) | [ ] | Carina_OP_Metering.md |
| 13.9 | POST /api/ops/estimate endpoint (pre-call cost estimate) | [ ] | Carina_OP_Metering.md |
| 13.10 | POST /api/ops/execute endpoint (credit reserve + execute + finalize) | [ ] | Carina_OP_Metering.md |
| 13.11 | GET /api/ops/usage endpoint (spend, burn, margins, model mix) | [ ] | Carina_OP_Metering.md |
| 13.12 | GET /api/ops/models endpoint (allowed classes, burn rate) | [ ] | Carina_OP_Metering.md |
| 13.13 | POST /api/ops/topup endpoint (credit pack purchase) | [ ] | Carina_OP_Metering.md |
| 13.14 | Credit balance checks with hard/soft caps and warnings at 50/80/95% | [ ] | Carina_OP_Metering.md |
| 13.15 | Model class routing policy (cheap/balanced/premium/frontier) | [ ] | Carina_OP_Metering.md |
| 13.16 | Plan-based model restrictions (tier limits) | [ ] | Carina_OP_Metering.md |
| 13.17 | Top-up packs (small/large burst usage) | [ ] | Carina_OP_Metering.md |
| 13.18 | Premium model gating | [ ] | Carina_OP_Metering.md |
| 13.19 | Margin reporting per org and per model | [ ] | Carina_OP_Metering.md |
| 13.20 | Admin controls for rate card updates | [ ] | Carina_OP_Metering.md |
| 13.21 | Reconciliation job (ledger vs provider invoices) | [ ] | Carina_OP_Metering.md |
| 13.22 | Estimated vs actual usage tracking | [ ] | Carina_OP_Metering.md |
| 13.23 | Margin guardrails (65% target; auto-downgrade on margin breach) | [ ] | Carina_OP_Metering.md |
| 13.24 | Overage packs sold at higher margin than included bundles | [ ] | Carina_OP_Metering.md |
| 13.25 | BYOK default for heavier teams (protect margins) | [ ] | Carina_OP_Metering.md |
| 13.26 | Customer-facing pricing page and plan comparison | [ ] | Carina_OP_Metering.md |
| 13.27 | Stripe usage-based billing wired to per-tenant token spend | [ ] | 4AS.md |
| 13.28 | Credit system with auto-reload (Claude-style) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 13.29 | Per-seat pricing model (post-90-day) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 13.30 | Manual credit adjustment in ops back office (deferred) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 13.31 | Tenant provisioning self-serve (org create) | [NEED] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 13.32 | Row-level security policies on all product tables | [ ] | 4AS.md |
| 13.33 | tenant_id on every Postgres table | [ ] | 4AS.md |
| 13.34 | Externalize CarinaOrchestrator state for horizontal scaling | [ ] | 4AS.md |
| 13.35 | Per-tenant system-prompt overlay | [ ] | 4AS.md |

## 14. MOBILE

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 14.1 | Mobile companion ops screens (post-90-day) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 14.2 | Phone control integration (as node) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 14.3 | Phone presence / heartbeat | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 14.4 | Phone file access | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |

## 15. DOCS AND PUBLIC RELEASE

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 15.1 | Channel setup guide per platform | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.2 | Migration guide (from Hermes, from OpenClaw) | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.3 | Full CLI reference doc site | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.4 | Provider configuration guide (`.env.example` + `providers info`) | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.5 | Plugin development guide | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.6 | API reference documentation | [~] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.7 | Changelog generation automation | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.8 | Versioning policy | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.9 | Breaking change policy | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.10 | Homebrew formula | [ ] | CARINA_MERGED_CAPABILITY_CHECKLIST.md |
| 15.11 | Docs build includes Carina Ops section | [NEED] | CARINA_OPS_LAUNCH_RUNBOOK.md |

## 16. LAUNCH / DEPLOY / PRODUCTION

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 16.1 | Production deploy with live Stripe price IDs | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 16.2 | Privacy policy / terms update for org data boundaries | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 16.3 | Beta program (3-5 design partners recruited) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 16.4 | Activation telemetry (deferred; audit covers v1) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 16.5 | `pnpm test` green in core and ops repos | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.6 | `hosted-isolation.test.ts` passes on staging | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.7 | `CARINA_OPS_PRODUCT_ENABLED=true` in production | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.8 | `TENANT_KEY_ENCRYPTION_KEY` set (32+ byte secret) | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.9 | TLS valid on app.carinaai.uk | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.10 | Stripe webhook endpoint registered with signing secret | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.11 | Test checkout/cancel/renew on staging | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.12 | Staging dry run (register → onboarding → checkout → workbench → audit → impersonation) | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.13 | 3 beta partners invited | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.14 | One-sentence pitch validated with 2 external buyers | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 16.15 | Configure install.carinaai.uk for curl installer | [NEED] | CONFIGURATION_READINESS.md |
| 16.16 | Route production agents through Scout | [NEED] | CONFIGURATION_READINESS.md |
| 16.17 | `TRUST_ATTESTER_PRIVATE_KEY` set and chain/RPC confirmed | [NEED] | CONFIGURATION_READINESS.md |
| 16.18 | ERC-8126 verification env vars enabled | [NEED] | CONFIGURATION_READINESS.md |
| 16.19 | Base mainnet claims reserved (currently Base Sepolia only) | [NEED] | CONFIGURATION_READINESS.md |

## 17. MANAGED AGENTS / CLAUDE PARITY

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 17.1 | Managed Agents > Quickstart wizard | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.2 | Managed Agents > Sessions management UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.3 | Managed Agents > Deployments UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.4 | Managed Agents > Environments UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.5 | Managed Agents > Credential vaults UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.6 | Managed Agents > Memory stores UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.7 | Managed Agents > Agents list/detail UI | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.8 | Files management in workbench | [NEED] | Carina_Ops_Claude_Platform_Compare.md |
| 17.9 | Batches support (Claude Batches API equivalent) | [NEED] | Carina_Ops_Claude_Platform_Compare.md |

## 18. PLATFORM INFRASTRUCTURE / 4AS

| # | Feature | Status | Source File |
|---|---------|--------|-------------|
| 18.1 | JWT session layer (Lucia or custom; bcryptjs exists) | [ ] | 4AS.md |
| 18.2 | Account/billing/usage dashboard (new frontend: Next.js/SvelteKit vs gateway) | [ ] | 4AS.md |
| 18.3 | SSO/SCIM for Enterprise tier (post-launch) | [ ] | CARINA_OPS_IMPLEMENTATION_PLAN.md / CARINA_OPS_LAUNCH_RUNBOOK.md |
| 18.4 | Approval workflows (post-launch) | [ ] | CARINA_OPS_LAUNCH_RUNBOOK.md |
| 18.5 | Generic AI marketplace (explicitly NOT building in 90 days) | [;] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 18.6 | Workflow builder (explicitly NOT building in 90 days) | [;] | CARINA_OPS_IMPLEMENTATION_PLAN.md |
| 18.7 | Profile isolation (multi-identity; dev/profile isolation) | [ ] | openCLAW_features.md |
| 18.8 | Apple/macOS ecosystem integrations (1Password CLI, Apple Notes, Reminders, Bear, Eight Sleep, RTSP/ONVIF) | [ ] | openCLAW_features.md |

---

## Summary Counts

| Status | Count |
|--------|-------|
| [ ] Not started / missing | ~120 |
| [~] Partial / in progress | ~40 |
| [NEED] Explicitly listed as needed | ~25 |
| [;] Intentionally out of scope | 2 |
| **TOTAL planned features extracted** | **~187** |

## Key Source Files

1. CARINA_MERGED_CAPABILITY_CHECKLIST.md; Primary inventory (631 lines)
2. carina_scout_empty_promises_gap.md; Promise vs reality gap audit (90 lines)
3. CARINA_OPS_IMPLEMENTATION_PLAN.md; Sprint roadmap (570 lines)
4. Carina_OP_Metering.md; Pricing and metering strategy (513 lines)
5. openCLAW_features.md; Feature porting priorities (250 lines)
6. hermes_tools_skills.md; Hermes feature reference (119 lines)
7. 4AS.md; Multi-tenant SaaS architecture (52 lines)
8. Carina_Ops_Claude_Platform_Compare.md; Claude platform parity (94 lines)
9. CARINA_OPS_LAUNCH_RUNBOOK.md; Launch checklist (102 lines)
10. CONFIGURATION_READINESS.md; Config/activation gaps (51 lines)
