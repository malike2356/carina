# Carina + Scout; Gap Analysis: Planned vs Built

**Generated:** 14 June 2026
**Last updated:** 15 June 2026 (Odysseus close prompts O1-O5, O7, O8)
**Source:** Full audit of `/opt/lampp/htdocs/verlox/carina/instructions/` (130+ files) against the actual codebase
**Method:** Read every instruction file, extracted every feature/endpoint/UI/module, cross-referenced against files on disk

**Status key:** `[ ]` NOT BUILT | `[~]` PARTIAL | `[x]` BUILT

---

## SECTION A: CARINA OPS PRODUCT (customer-facing SaaS on app.carinaai.uk)

### A.1; Backend Modules (core.carinaai.uk/src/hosted/)

Status: **BUILT.** All 13 modules exist with tests.

| Module | Source in instructions | Status |
|--------|----------------------|--------|
| org-service.ts | action-prompts/carina-ops/02 | [x] |
| org-types.ts | action-prompts/carina-ops/01 | [x] |
| org-context.ts | action-prompts/carina-ops/08 | [x] |
| rbac.ts | action-prompts/carina-ops/03 | [x] |
| plan-features.ts | action-prompts/carina-ops/00,13 | [x] |
| plan-gates.ts | action-prompts/carina-ops/13 | [x] |
| scoped-query.ts | action-prompts/carina-ops/09 | [x] |
| product-audit.ts | action-prompts/carina-ops/10 | [x] |
| org-invites.ts | action-prompts/carina-ops/05,33 | [x] |
| org-backfill.ts | action-prompts/carina-ops/06 | [x] |
| vault-service.ts | action-prompts/carina-ops/19 | [x] |
| workbench-service.ts | action-prompts/carina-ops/20 | [x] |
| usage-service.ts | action-prompts/carina-ops/21,27 | [x] |
| billing-summary.ts | action-prompts/carina-ops/25,26 | [x] |
| ai-platform-models.ts | action-prompts/carina-ops/17,18 | [x] |
| ai-platform-schema.ts | action-prompts/carina-ops/17 | [x] |
| ai-platform-migrate.ts | action-prompts/carina-ops/17 | [x] |
| deployments-service.ts | action-prompts/carina-ops/23 | [x] |
| onboarding-service.ts | action-prompts/carina-ops/30 | [x] |
| invite-email.ts | action-prompts/carina-ops/33 | [x] |
| redact.ts | action-prompts/carina-ops/35 | [x] |

### A.2; Customer API Routes (core.carinaai.uk/src/api/carina-ops-routes.ts)

Status: **BUILT.** 381-line router exists with handlers for overview, vault CRUD, workbench, usage, credits, billing summary, audit, deployments, environments, onboarding.

### A.3; Customer UI Pages (core.carinaai.uk/src/gateway/web/ops/)

Status: **BUILT.** 12 HTML files exist: index, audit, billing, settings, upgrade, usage, vault, workbench, onboarding (+ layout.js, ops.css).

| UI Page | Source in instructions | Status |
|---------|----------------------|--------|
| index.html (overview) | action-prompts/carina-ops/14 | [x] |
| vault.html (BYOK) | action-prompts/carina-ops/19 | [x] |
| workbench.html | action-prompts/carina-ops/20 | [x] |
| usage.html | action-prompts/carina-ops/21 | [x] |
| audit.html | action-prompts/carina-ops/22 | [x] |
| billing.html | action-prompts/carina-ops/25,28 | [x] |
| settings.html | action-prompts/carina-ops/14 | [x] |
| upgrade.html | action-prompts/carina-ops/28 | [x] |
| onboarding.html | action-prompts/carina-ops/30,31 | [x] |

### A.4; Ops Back Office (ops.carinaai.uk)

Status: **BUILT.** All tenant CRUD, subscriptions, impersonation, BYOK management, pack management already live on port 4002.

### A.5; Carina Ops GAPS (things the action prompts call for but are NOT built)

| Gap | Source | What's missing |
|-----|--------|---------------|
| [ ] Live Stripe price IDs for carina_ops_starter / carina_ops_team | 00-lock-spec, 25-stripe-checkout | STRIPE_PRICE_CARINA_OPS_STARTER and STRIPE_PRICE_CARINA_OPS_TEAM not in production .env; plans defined in billing-plans.ts but Stripe integration wiring incomplete |
| [ ] Stripe Customer Portal URL | 25-stripe-checkout | Billing page has placeholder; portal not configured |
| [ ] Docs site (docs.carinaai.uk) with getting-started | 37-docs-getting-started | No Docusaurus/VitePress docs site deployed for customers |
| [ ] Marketing pricing page on carinaai.uk | 36-marketing-pricing-page | Pricing page not updated with Ops tier details |
| [ ] Privacy policy / ToS for org data boundaries | CARINA_OPS_IMPLEMENTATION_PLAN.md | Legal docs not published |
| [ ] Beta program (3+ design partners) | CARINA_OPS_IMPLEMENTATION_PLAN.md | No beta program launched |
| [ ] Trial support (14-day Team trial) | 29-trial-support | Trial logic not wired into Stripe checkout flow |
| [ ] Usage limits warnings (email to org owner at 80%/90%/100%) | 27-usage-limits-warnings | Not implemented |
| [ ] Launch checklist runbook execution | 38-launch-checklist-runbook | Runbook exists as action prompt but not executed |
| [~] CARINA_OPS_PRODUCT_ENABLED flag | 00-lock-spec | Not verified in production .env |
| [ ] Hosted mode tenant sign-up flow on app.carinaai.uk | Various | Backend routes exist; public-facing registration page needs verification |

---

## SECTION B: SCOUT FEATURES (console.labyrinthscout.com)

### B.1; Scout Core (BUILT)

Status per TRUST_BUILD_CHECKLIST.md: Phases A, B, C, D, E, F are 94-100% done. All 10 Scout security features that were "NOT BUILT" per carina_scout_empty_promises_gap.md are now BUILT.

### B.2; Scout GAPS

| Gap | Source | What's missing |
|-----|--------|---------------|
| [ ] pending_approvals DB table and migration | feature-approval-workflow.md | Approval router exists BUT the migration adding the pending_approvals table was never created. Approval workflow code references a table that does not exist in migrations.ts |
| [~] First weekly labyrinth-scout.v1 attestation post on Base Sepolia | TRUST_BUILD_CHECKLIST.md C.2 | Code complete; needs operator to run `pnpm trust:attest` (awaiting 30-day clean window or manual run) |
| [~] Base mainnet ERC-8004 registration | TRUST_BUILD_CHECKLIST.md C.1 | `pnpm trust:register:mainnet` exists but not yet run by operator |
| [ ] Enterprise pilot / LOI / MRR targets | TRUST_BUILD_CHECKLIST.md G | Business items, not code |
| [ ] 5 target enterprises identified | TRUST_BUILD_CHECKLIST.md G | Outreach template exists; targets not identified |
| [ ] Scout alert channel credentials configured | CONFIGURATION_READINESS.md | Code exists; SCOUT_ALERT_TO_EMAIL, RESEND_API_KEY, Telegram/Slack/Discord credentials need setting in production .env |

---

## SECTION C: gap100.md FEATURES (Hermes/OpenClaw parity)

These are the "Prompt 1-10" items from `instructions/gap-analysis/gap100.md`. This is the largest block of genuinely unbuilt work.

### C.1; Provider Breadth and Free Copilot (Prompt 1)

| Item | Status | Notes |
|------|--------|-------|
| Provider health checks + caching | [~] | Provider registry exists (23 providers); health check/caching not verified |
| Free Copilot preset | [x] | github-copilot in provider-registry.ts (3 occurrences) |
| Provider catalog CLI/TUI display | [~] | /model and /provider commands exist; completeness not verified |

### C.2; Channel Breadth and Thread Ownership (Prompt 2)

| Item | Status | Notes |
|------|--------|-------|
| [ ] Channel status reporting (configured/connected/partial/disabled) | Honest status per channel not exposed in ops UI |
| [ ] WhatsApp bridge hardening + default-off docs | Adapter code exists but production config pending |
| [ ] Signal channel configuration | Adapter stub exists; not production-hardened |
| [ ] iMessage/BlueBubbles | Adapter stub exists; not production-ready |
| [ ] Matrix channel | Not built |
| [ ] Mattermost channel | Not built |
| [ ] IRC channel | Sidecar webhook contract only; no live client |
| [ ] Thread ownership enforcement (Slack, Discord, Telegram, WhatsApp) | Per-thread agent ownership not implemented |
| [ ] DM pairing/allowlisting (approve/reject/revoke/rotate) | Not built |
| [ ] Directory lookup across channels | Not built |
| [ ] Channel routing rules with ownership metadata | Not verified |
| [ ] Channel health dashboard in ops panel UI | CLI done; no ops UI |

### C.3; Node Host, Pairing, Sandbox, Approvals (Prompt 3)

Status: **PARTIAL.** O7 close prompt (15 June 2026) added daemon supervision and token pairing; legacy `carina pairing` and `src/infrastructure/host-service.ts` remain. Sandbox manager and approval daemon still missing.

| Item | Status | Notes |
|------|--------|-------|
| Node host daemon mode (install/start/stop/restart/status/uninstall) | [x] | `src/host/daemon.ts`, expanded `host-cli` (`install`, `start`, `stop`, `restart`, `status`, `uninstall`, `logs`, `supervise`); 6 tests |
| Device pairing (token-based, approve/reject/revoke/rotate) | [x] | `src/pairing/pairing.ts`, `carina pair` CLI, `/api/pair/*` routes; legacy `/api/pairing/*` preserved; 7 tests |
| QR code pairing for mobile onboarding | [x] | Terminal QR block in `pair-cli` |
| Gateway-to-node communication (command dispatch, status, file transfer) | [~] | `src/infrastructure/host-service.ts`, `node-host/` predate O7; full mesh/file transfer not verified |
| Sandbox backend (create/list/recreate/explain/teardown) | [~] | Docker sandbox exists for code-exec; general sandbox manager does not |
| Approval daemon (allow/block/approve-with-expiry, per-agent policy) | [ ] | `src/approvals/` does not exist as standalone daemon |
| Node/sandbox/approval visibility in CLI/ops | [~] | `carina host status/logs`; ops UI not updated |

### C.4; Plugin Ecosystem (Prompt 4)

| Item | Status | Notes |
|------|--------|-------|
| [x] Plugin manifest definition | src/extensions/manifest.ts exists |
| [~] Plugin lifecycle commands (install/list/enable/disable/remove/rollback/validate) | Manifest validator exists; full CLI not verified |
| [ ] Plugin install from git repo / archive / local path | Not built |
| [ ] Plugin contribution points (tools, skills, prompts, integrations) | Extension validator exists but full plugin loader not verified |
| [ ] Plugin activation gating with eval | Not built |
| [ ] Plugin visibility in CLI/ops | Not built |

### C.5; TaskFlows, ACP, Debug Proxy (Prompt 5)

**Entire section: NOT BUILT**

| Item | Status | Notes |
|------|--------|-------|
| [ ] TaskFlows / durable automation workflow registry | src/workflows/ does not exist |
| [ ] Background task inspection (queued/running/succeeded/failed/timed out/cancelled/lost) | Not built |
| [ ] ACP bridge (client mode, bridge mode, session management) | src/acp/ does not exist (ACP endpoint exists at /acp/prompt but full bridge does not) |
| [ ] Provider debug proxy (capture by ID, payload inspection, data purge) | src/debug/ does not exist |
| [ ] Plugin/bundle distribution (install from git/archive/local) | Not built |

### C.6; Memory Fabric and Skill Workshop (Prompt 6)

| Item | Status | Notes |
|------|--------|-------|
| [~] Episodic memory persistence | Exists in Postgres via episodic_memories table |
| [~] Semantic search over long-term memory | pgvector backend exists; semantic search wiring not verified |
| [~] Consolidation / cap-awareness | memory-consolidation skill exists but as Hermes skill, not Carina code |
| [ ] Skill curator flows (stale/duplicate/archival handling) | Not built as automated system |
| [ ] Skill workshop flow for capturing workflows | Not built |
| [ ] Published pack discoverability / hub | Hub code exists but not public-facing |
| [ ] Skill eval offline harness integration | Eval reports shown in packs UI; full harness not verified |

### C.7; Migration, Backup, Doctor, Secrets (Prompt 7)

**Majority NOT BUILT**

| Item | Status | Notes |
|------|--------|-------|
| [ ] Import Hermes config/memory/skills/credentials | Not built |
| [ ] Import Claude instructions/MCP/skills | Not built |
| [ ] Backup/restore with manifest + integrity | ops/backup paths exist in carina ops CLI; full backup/restore not verified |
| [ ] Doctor / health check command (config, providers, memory, gateway, deps) | Doctor checks exist in Scout; no comprehensive Carina doctor |
| [ ] Secrets audit (plaintext detection, precedence drift) | Not built |
| [ ] Session listing / status / logs / approvals management CLI | Partially exists via process/log tools |
| [ ] Shell completion | Not built |
| [ ] Uninstall command | Not built |

### C.8; Security, Trust, Billing, Release Hardening (Prompt 8)

| Item | Status | Notes |
|------|--------|-------|
| [~] Production billing with live Stripe IDs | Placeholder key; not live |
| [ ] Clean install smoke test on fresh machine | Not performed |
| [ ] npm install verification (fresh machine) | Package published; fresh install not verified |
| [ ] Public copy audit (remove overstated claims) | Partially addressed; carinaai.uk updated with trust dashboard |

### C.9; Mobile Parity (Prompt 9)

| Item | Status | Notes |
|------|--------|-------|
| [ ] Mobile chat/trust/packs/memory/billing surfaces verified | carinaMobile/ exists but completeness not verified |
| [ ] Session handling stable across app restarts | Not verified |
| [ ] Push registration, voice input, widget features gated | Not verified |
| [ ] Auth/session alignment with core | Not verified |
| [ ] Blank screen / stale state / error handling | Not verified |

### C.10; Documentation and Canonical Capabilities (Prompt 10)

| Item | Status | Notes |
|------|--------|-------|
| [ ] /docs/capabilities as canonical inventory | docs exist but capability page not verified |
| [ ] Runtime /help points to capabilities | Not verified |
| [~] Marketing copy audit (no overclaims) | Partially addressed; carinaai.uk updated with trust dashboard |
| [~] Comparison/pricing pages honest | `carina about`, `docs/MIT-vs-AGPL.md`, web UI MIT footer added (O8) |

---

## SECTION H: ODYSSEUS PARITY CLOSE PROMPTS (ODYSSEUS_CLOSE_PROMPTS.md)

Tracked separately from gap100.md (Section C). Source: `instructions/gap-analysis/ODYSSEUS_CLOSE_PROMPTS.md`.

| Prompt | Feature | Priority | Status | Implementation notes |
|--------|---------|----------|--------|---------------------|
| O1 | `carina cookbook` (model discovery + serve) | P0 | [x] | `src/cookbook/` (hardware, catalog, recommender, serve); `carina cookbook` CLI; 15 tests |
| O2 | Deep Research (named feature) | P0 | [x] | `src/agents/deep-research.ts`; `carina research` CLI; `/research` gateway command; 6 tests |
| O3 | Model Compare | P1 | [x] | `src/agents/compare.ts`; `carina compare` CLI; `/compare` gateway command; blind mode; 6 tests |
| O4 | Document Editor (web UI) | P2 | [x] | `src/gateway/documents-api.ts`, `documents-store.ts`, `/documents` page + `documents.js`; SQLite `carina_documents`; 6 tests |
| O5 | Notes and Tasks surface | P2 | [x] | `notes-api`, `notes-store`, `reminder-delivery`, `/notes` UI; todo/cronjob sync; 8 tests |
| O6 | Image Gallery surface | P2 | [x] | `images-api`, `images-store`, `images-provider`, `/images` UI; agent tool sync; 5 tests |
| O7 | Node host daemon + device pairing | P1 | [x] | `src/host/daemon.ts`, `src/pairing/pairing.ts`, expanded `host-cli` + `pair-cli`; 13 tests |
| O8 | MIT vs AGPL copy (commercial edge) | P1 | [x] | `carina about`; `carina --version` MIT line; `docs/MIT-vs-AGPL.md`; MIT footer on all web UI pages; "Why Carina" panel on chat index |

### H.1; O1-O3 detail (named Odysseus-flagship features)

| Capability | Odysseus parity | Carina surface | Status |
|------------|-----------------|----------------|--------|
| Model cookbook (hardware scan, catalog, serve commands) | First-class | `carina cookbook [list|search|inspect|serve]` | [x] |
| Deep research (multi-step, cited report) | First-class | `carina research`, `/research` | [x] |
| Model compare (parallel fan-out, blind mode) | First-class | `carina compare`, `/compare` | [x] |

### H.2; O8 detail (MIT commercial story)

| Surface | Status | Notes |
|---------|--------|-------|
| `carina about` | [x] | Version, MIT URL, AGPL contrast, docs/hosted/scout links |
| `carina --version` | [x] | Includes `MIT License | Build commercial products freely` |
| Web UI footer (all pages) | [x] | `packages/web/src/license-footer.ts` injected via `web-server.ts` |
| Chat index "Why Carina" panel | [x] | Injected above `#chat-scroll` on main index |
| `docs/MIT-vs-AGPL.md` | [x] | Factual AGPL vs MIT comparison for builders |

### H.3; Odysseus workspace gaps (closed) and remaining polish

| Gap | Status | What is still missing |
|-----|--------|----------------------|
| Document editor in web UI | [x] | `/documents` editor with auto-save, preview, export, AI assist (O4) |
| Notes and tasks workspace | [x] | `/notes` with filters, task checkboxes, reminders, AI assist (O5) |
| Image gallery + edit/inpaint | [x] | `/images` masonry gallery, generate, lightbox, inpaint, remove-bg (O6) |
| Unified workspace polish | [x] | `/workspace` hub; shared sidebar shell on notes, documents, images, memory, packs; chat sidebar links |
| Email assistant (Odysseus flagship) | [x] | `/email` triage UI; urgency, archive, spam; `email-api` on `inbound_emails` |
| Hosted workspace parity | [x] | Workspace sidebar and user menu visible for BYOK hosted users; tenant-scoped notes/docs/images APIs |
| Workspace themes | [x] | Light/dark toggle on workspace shell; syncs with chat via `carina_web_prefs` |
| Calendar (reminder view) | [x] | `/calendar` month grid from note reminders (CalDAV deferred) |

**Post-O8 focus:** Complete for operator and hosted UI parity. CalDAV sync remains future work.

**Next recommended close order:** Per-tenant inbound email routing; CalDAV calendar sync; tool hardening (Section D).

---

## SECTION D: TOOL HARDENING (action-prompts/tool-*)

These are fix-and-test tasks. Status per the AGENTS.md tracking table: most tools exist but have incomplete error handling or test coverage.

| Tool | Source | Issue | Status |
|------|--------|-------|--------|
| cronjob | tool-22-cronjob.md | Wrap async calls in try/catch; add 9 tests | [ ] |
| execute-code | tool-17-execute-code.md | Clear Docker-unavailable error; add 10 tests | [ ] |
| delegate-task | tool-16-delegate-task.md | Batch failure isolation; add 4 tests | [~] |
| skills-list/view/manage | tool-25-27-skills-tools.md | DB error wrapping; add 16 tests | [ ] |
| text-to-speech | tool-24-text-to-speech.md | try/catch wrapping; add 6 tests | [ ] |
| send-message | tool-23-send-message.md | Outer try/catch; add 11 tests | [ ] |
| clarify | tool-19-20-clarify-session-search.md | Context injection + turn loop fix; add 6 tests | [ ] |
| session-search | tool-19-20-clarify-session-search.md | GIN index migration fix, SQL fix; add 4 tests | [ ] |
| process | tool-15-process.md | try/catch wrapping; add 5 tests | [ ] |
| browser (all 12 functions) | tool-01-09-browser.md | try/catch wrapping; create session.test.ts | [ ] |
| terminal | tool-10-terminal.md | CARINA_DIRECT_SHELL, workdir fix, 50KB cap | [~] |
| file-read/write/search-files/patch | tool-11-14-file-tools.md | Line numbers, syntax checks, fuzzy patch | [~] |

---

## SECTION E: CARINA OPS BACK OFFICE FEATURES (ops.carinaai.uk action prompts specifically for ops.carinaai.uk)

The action prompts 00-38 describe a parallel set of changes for `ops.carinaai.uk`:

| Gap | Source | What's missing |
|-----|--------|---------------|
| [ ] ops.carinaai.uk lib/org-service.ts (mirror) | 01-org-migrations | hosted/ code exists in core but ops lib mirror not created |
| [ ] ops.carinaai.uk routes/carina-ops.ts (support API) | 15-carina-ops-api-router | Router not created; ops already has direct tenant routes |
| [ ] ops.carinaai.uk routing upgrade (EJS -> API + static) | 16-ops-routing-upgrade-cta | Current EJS rendering works; migration not done |
| [ ] Manual credit adjustment in ops back office | CARINA_OPS_IMPLEMENTATION_PLAN.md | Deferred post-launch |
| [ ] Activation telemetry beyond product_audit_log | CARINA_OPS_IMPLEMENTATION_PLAN.md | Deferred |

---

## SECTION F: TRUST / BLOCKCHAIN (TRUST_BUILD_CHECKLIST.md)

### Remaining [ ] items

| Item | Phase | Type |
|------|-------|------|
| [ ] One paying enterprise pilot OR signed LOI | B | Business |
| [ ] First live labyrinth-scout.v1 attestation post | C | Operator action |
| [ ] Pilot customer with on-chain attestation visible | C | Business |
| [ ] Revenue target £5K+ MRR | D | Business |
| [ ] Identify 5 target enterprises | G | Business |
| [ ] First free pilot with security log collection | G | Business |
| [ ] Convert pilot to £2,500-5,000/mo paid | G | Business |
| [ ] Track metrics (support tickets, Scout alerts, CAC, MRR) | G | Business |
| [ ] Time to first paying customer < 45 days | G | Business |
| [ ] MRR £10K+ | G | Business |
| [ ] Scout alerts < 1 critical per 1000 agent actions | G | Business |

All code items in the trust checklist are DONE. Remaining items are business/operator, not code.

---

## SECTION G: WEBSITE PROMISE GAPS (carina_scout_empty_promises_gap.md)

Original audit found ~20% fulfillment. Current state:

| Original Gap | Status | Notes |
|-------------|--------|-------|
| Prompt injection shield | [x] | BUILT; 3-layer detection |
| Moving target deception | [x] | BUILT; honeypots + markers |
| Real-time security dashboard | [x] | BUILT; console.labyrinthscout.com/dashboard |
| Multi-channel alerting | [x] | BUILT; 6 channels (code complete; needs config) |
| Deception layer (honeypots) | [x] | BUILT |
| Heuristic anomaly detection | [x] | BUILT |
| Tool allowlisting & rate limiting | [x] | BUILT |
| Kill switch | [x] | BUILT |
| Full audit log & compliance | [x] | BUILT |
| Egress filtering & DLP | [x] | BUILT |
| Switch providers mid-session | [x] | BUILT; /model command |
| npm install | [x] | BUILT; carina-agent@0.1.0 on npm |
| Vertical skill packs (property-uk) | [~] | Pack system built; property-UK live data feeds not configured |
| Memory transparency (view/edit) | [~] | Memory browser exists in ops; user-facing /memory page not verified |
| Works with any agent | [x] | BUILT; 6 integration adapters |

---

## SUMMARY: What's Actually Not Built

### Priority 1: Code That's Missing (can build now)

1. **pending_approvals DB migration**; Scout approval router exists but references a table with no migration (feature-approval-workflow.md)
2. **TaskFlows / durable automation**; gap100.md Prompt 5 not started (workflow registry, task inspection, chaining)
3. **ACP bridge**; Not built beyond /acp/prompt endpoint
4. **Provider debug proxy**; Not built
5. **Migration tools** (Hermes→Carina, Claude→Carina import); Not built
6. **Comprehensive doctor/health command**; Scout doctor exists; Carina doctor incomplete
7. **Secrets audit tool**; Not built
8. **Channel hardening**; Thread ownership, DM allowlisting, directory lookup not implemented; WhatsApp/Signal/iMessage/Matrix/Mattermost/IRC channels not production-ready
9. **Tool hardening tests**; 12 tools need try/catch wrapping and additional tests per action prompts
10. **Odysseus workspace surface O6**; Image gallery done: `/images`, API, agent tool sync (see Section H)
11. **Approval daemon**; gap100.md Prompt 3; `src/approvals/` standalone daemon not built

### Priority 2: Configuration/Operator Actions (not code)

12. **Live Stripe price IDs** for Carina Ops plans in production .env
13. **Scout alert channel credentials** (email, Telegram, Slack, Discord) in production .env
14. **First weekly labyrinth-scout.v1 attestation**; `pnpm trust:attest`
15. **Base mainnet ERC-8004 registration**; `pnpm trust:register:mainnet`
16. **Documentation site** (docs.carinaai.uk) with getting-started, capabilities, channel setup guides

### Priority 3: Business/Marketing (not code)

17. Enterprise pilot identification and outreach
18. Privacy policy / ToS for org data
19. Beta program launch
20. Marketing pricing page update
21. Clean install verification on fresh machine

### Already Built (from original gap list; no longer gaps)

- All 10 Scout security features (were "NOT BUILT"; now LIVE)
- npm package carina-agent@0.1.0 (was "NO"; now LIVE)
- Provider switching mid-session (was "NO"; now BUILT)
- Carina Ops hosted modules (all 20+ hosted/*.ts files with tests)
- Carina Ops customer UI (12 HTML pages in web/ops/)
- Carina Ops customer API (381-line carina-ops-routes.ts)
- Trust stack (ERC-8004 + ERC-8126 on Base Sepolia)
- Public trust dashboard (carinaai.uk/trust)
- Scout SDK (sdk/node/)
- Scout governance/approval/regulatory routers
- Plugin manifest system (extensions/)
- github-copilot in provider registry
- **Odysseus parity O1-O5, O7, O8** (15 June 2026): cookbook, research, compare, documents, notes/tasks, node host daemon, device pairing, MIT commercial copy (see Section H)

---

## Source File Index

| Source File | Section Above |
|------------|--------------|
| instructions/action-prompts/carina-ops/00-38 | A |
| instructions/action-prompts/feature-*.md | B |
| instructions/action-prompts/tool-*.md | D |
| instructions/gap-analysis/gap100.md | C |
| instructions/gap-analysis/ODYSSEUS_CLOSE_PROMPTS.md | H |
| instructions/gap-analysis/ODYSSEUS_2026-06-15.md | H |
| instructions/gap-analysis/ODYSSEUS_ANALYSIS.md | H |
| instructions/trust/TRUST_BUILD_CHECKLIST.md | F |
| instructions/strategy/carina_scout_empty_promises_gap.md | G |
| instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md | A, E |
| instructions/strategy/CONFIGURATION_READINESS.md | B, Summary |
| instructions/strategy/CARINA_MERGED_CAPABILITY_CHECKLIST.md | C |
| instructions/strategy/openCLAW_features.md | C |
| instructions/strategy/4AS.md | C |
| instructions/strategy/Carina_OP_Metering.md | C |
| instructions/strategy/Carina_Ops_Claude_Platform_Compare.md | C |
| instructions/operations/BUILD_NEXT_CHECKLIST.md | Tool parity |
| instructions/operations/FINAL_AUDIT.md | Dashboard, tests |
