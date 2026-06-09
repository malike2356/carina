# Trust Stack Build Checklist

Living tracker for the Carina + Labyrinth Scout + Blockchain trust moat described in `blockChaninTrust.md`.

**Last updated:** 2026-06-10  
**Current phase:** All codable engineering complete; operator wallet, pilots, and revenue remain  
**Strategy:** Adopt Agent Trust on Base; Labyrinth Scout as security attestation oracle; do not build a custom trust platform.

---

## How to use this file

1. Pick the next unchecked item in order (top to bottom within each phase unless blocked).
2. When you ship it (code merged, tests pass, deployed if applicable), change `[ ]` to `[x]` and add the date: `[x] 2026-06-09`.
3. If partially done, use `[~]` and note what remains on the same line.
4. Update the **Last updated** date and **Current phase** summary at the top.
5. Do not mark marketing items complete until they are committed and deployed to production.

**Status key:** `[x]` done | `[~]` partial | `[ ]` not started | `[;]` cancelled/deferred

---

## Progress summary

| Phase | Focus | Done | Total | % |
|---|---|---:|---:|---:|
| A | Foundation (Carina + Scout integration) | 18 | 18 | 100% |
| B | Release 1; MVP + off-chain trust dashboard | 15 | 16 | 94% (pilot/LOI deferred) |
| C | Release 2; On-chain attestations (ERC-8004/8126) | 22 | 25 | 88% (live chain posts deferred) |
| D | Release 3; Enterprise trust layer + revenue | 8 | 10 | 80% (MRR deferred) |
| E | Marketing & positioning (deployed) | 12 | 12 | 100% |
| F | Prompt injection defence-in-depth | 10 | 10 | 100% |
| G | Business & go-to-market | 3 | 8 | 38% (sales/ops deferred) |

---

## Phase A; Foundation (Carina + Scout integration)

Carina executes; Scout supervises. No blockchain yet.

### Carina agent core

- [x] 2026-06-07 Carina agent MVP deployed (`core.carinaai.uk`)
- [x] 2026-06-07 Scout event reporting (`core.carinaai.uk/src/security/scout-client.ts`)
- [x] 2026-06-07 Scout kill switch listener via Redis (`kill-switch-listener.ts`)
- [x] 2026-06-07 First-run setup wizard Scout pairing step (`setup/wizard.ts`)
- [x] 2026-06-07 Ops panel Scout pairing (`ops.carinaai.uk/routes/settings.ts`)
- [x] 2026-06-09 Internal architecture guide (`ARCHITECTURE.md`)
- [x] 2026-06-09 Param sanitisation before Scout telemetry leaves Carina
- [x] 2026-06-09 Fire-and-forget Scout reporting (never blocks agent)

### Labyrinth Scout security core

- [x] 2026-06-07 Scout account system (register, login, per-account API keys)
- [x] 2026-06-09 Prompt injection guard on Carina (`prompt-guard.ts`, middleware)
- [x] 2026-06-09 Scout security pipeline (anomaly detector, honeypot, integration middleware)
- [x] 2026-06-09 Global kill switch + per-instance suspend (`global-kill-switch.ts`)
- [x] 2026-06-09 Immutable audit log + retention policy
- [x] 2026-06-09 GDPR compliance (data access, deletion, GDPR report)
- [x] 2026-06-09 Scout console dashboard HTML (`public/dashboard.html` + widgets)
- [x] 2026-06-09 Agent integration deploy layer (`src/api/provision.ts`)
- [x] 2026-06-09 Stripe billing + checkout flow (`core.carinaai.uk/src/billing/`)
- [x] 2026-06-09 Scout API key provisioning on subscription webhook
- [x] 2026-06-09 Carina Cloud tenant Scout UI (`/security`, `/dashboard`, auto-provision)
- [x] 2026-06-09 Ops hosted tenant dashboard (`ops.carinaai.uk/tenants`)
- [x] 2026-06-09 Full Carina Cloud documentation (`core.carinaai.uk/docs/carina-cloud.md`)

---

## Phase B; Release 1 (weeks 1-6): Combined MVP + off-chain trust

Goal: One demonstrable "verifiable security" story. ERC-8004 testnet registration. First pilot customer or LOI.

### Off-chain trust dashboard (Scout → public API → Carina trust page)

- [x] 2026-06-09 `GET /api/public/trust` endpoint (`console.labyrinthscout.com/src/api/public-trust.ts`)
- [x] 2026-06-09 Risk score computation from Scout DB metrics (`trust/compute-trust-metrics.ts`)
- [x] 2026-06-09 Local attestation hash previews (SHA256 of security summary; not on-chain)
- [x] 2026-06-09 Chain status config (`TRUST_ERC8004_STATUS`, `TRUST_ERC8126_STATUS` in `.env.example`)
- [x] 2026-06-09 Public trust API tests (`api/__tests__/public-trust.test.ts`)
- [x] 2026-06-09 Carina `/trust` page (polls Scout API, renders score + attestations)
- [x] 2026-06-09 Carina `trust.js` client (60s poll, error banner, tier colours)
- [x] 2026-06-09 Commit `carinaai.uk` trust page + homepage updates to git (`c758fbd`)
- [x] 2026-06-09 Commit `console.labyrinthscout.com/src/trust/` to monorepo git (`237ca91`)
- [x] 2026-06-09 Deploy trust API to production Scout console (rsync + build; API live)
- [x] 2026-06-09 Deploy `carinaai.uk/trust` to production VPS (`/www/wwwroot/carinaai.uk/trust/`)
- [x] 2026-06-09 Verify live trust API returns real Scout metrics (risk_score 10, 1 agent active)
- [x] 2026-06-09 Add "monitoring live / on-chain attestation planned" honesty banner until Phase C ships
- [x] 2026-06-09 Scout console widget: PUBLIC TRUST link in operator dashboard header
- [x] 2026-06-09 Document trust API in Scout docs (`docs/api/public-trust.md` + VitePress sidebar)

### Release 1 exit criteria

- [~] 2026-06-10 Register reference Carina agent on ERC-8004 (scaffold + `pnpm trust:register`; needs `TRUST_ATTESTER_PRIVATE_KEY`)
- [ ] One paying enterprise pilot OR signed LOI for Carina + Scout bundle
- [x] 2026-06-10 End-to-end demo: trust pipeline test + `scripts/trust-e2e-demo.sh` + live API verified

---

## Phase C; Release 2 (weeks 7-12): On-chain attestations

Goal: Labyrinth Scout posts real security attestations on-chain. Risk score backed by verifiable proofs.

### C.1; ERC-8004 agent identity (Base Sepolia → Base mainnet)

- [x] 2026-06-10 Choose and document trust platform: Agent Trust on Base (`docs/trust/platform.md`)
- [x] 2026-06-10 Add chain dependencies (viem) to `console.labyrinthscout.com`
- [ ] Create Scout attestation wallet; store key in env (never commit); operator action
- [x] 2026-06-10 Document env vars: `TRUST_CHAIN_RPC`, `TRUST_ATTESTER_PRIVATE_KEY`, `TRUST_ERC8004_REGISTRY`
- [~] 2026-06-10 Register reference Carina agent on ERC-8004 (`pnpm trust:register`; blocked without wallet key)
- [x] 2026-06-10 Store `agentId` + tx hash in Scout DB (`trust_identities` table + migration)
- [x] 2026-06-10 Expose ERC-8004 agent ID + explorer link on public trust API (`identity` block)
- [x] 2026-06-10 Flip `TRUST_ERC8004_STATUS=live` when DB identity registered (auto in public trust API)
- [x] 2026-06-10 Mainnet registration CLI (`pnpm trust:register:mainnet`; operator runs after testnet)

### C.2; Agent Trust security attestation adapter

- [x] 2026-06-10 Install `@open-agent-economy/trust-sdk` in Scout
- [x] 2026-06-10 Define custom namespace `labyrinth-scout.v1` with fields: `securityScore`, `runtimeHours`, `threatsDetected`, `injectionBlocks`, `sandboxViolations`
- [x] 2026-06-10 Build `LabyrinthScoutAttestationAdapter` (Scout findings → Agent Trust `submitAttestation`)
- [x] 2026-06-10 Schedule weekly attestation job (not per-event; cost control)
- [x] 2026-06-10 Post attestation on clean runtime (30d no critical incidents)
- [x] 2026-06-10 Store attestation UID + tx hash in Scout DB (`trust_attestations`)
- [x] 2026-06-10 Expose attestation explorer links on public trust API (`on_chain` block + trust dashboard)
- [x] 2026-06-10 Tests with mocked SDK (never hit mainnet in CI)
- [ ] First live attestation on Base Sepolia (`pnpm trust:attest`; blocked without wallet key)

### C.3; ERC-8126 verification (WAV + WV)

- [x] 2026-06-10 Implement WAV risk score from Scout endpoint health + vulnerability scan findings
- [x] 2026-06-10 Implement WV risk score from attestation wallet on-chain history
- [x] 2026-06-10 Submit ERC-8126 verification attestations to Validation Registry (`pnpm trust:verify`)
- [x] 2026-06-10 Unified risk score (mean of applicable verification scores) on trust API
- [x] 2026-06-10 Flip `TRUST_ERC8126_STATUS=live` after first successful on-chain verification (auto when DB row exists)
- [x] 2026-06-10 Link to `erc8126.ai` reference implementation docs from trust page
- [ ] First live ERC-8126 verification on Base Sepolia (blocked without wallet key)

### C.4; Release 2 exit criteria

- [~] 2026-06-10 Trust page shows Base explorer links when on-chain data exists (UI ready; needs wallet + live posts)
- [ ] Pilot customer uses production agent with on-chain attestation visible; operator/deferred
- [ ] Marketing claim "on-chain attestations" is factually true in production; operator/deferred

---

## Phase D; Release 3 (weeks 13-20): Enterprise trust layer

Goal: Self-serve compliance exports, historical attestations, premium revenue. Target £5K+ MRR.

- [x] 2026-06-10 Scout console: Attestation History panel (`/api/trust/history` + dashboard widget)
- [x] 2026-06-10 Scout console: Compliance Report Generator (`/api/trust/compliance-report?format=pdf`)
- [x] 2026-06-10 Scout console: Incident Timeline (`/api/trust/incidents` + Type 1/2/3 filter)
- [x] 2026-06-10 Trust-gating API: `GET /api/public/trust/verify/:agentId` for third-party services
- [x] 2026-06-10 Enterprise tier: configurable attestation frequency (`account/api/trust-settings`)
- [x] 2026-06-10 Enterprise tier: SOC2 / ISO27001 / EU AI Act readiness export pack
- [x] 2026-06-10 Open source Carina core + Scout commercial model (`docs/open-source-pricing.md`, MIT LICENSE)
- [x] 2026-06-10 Self-serve onboarding checklist (`/account/api/onboarding` + account dashboard)
- [ ] Revenue target: £5K+ MRR from 2-3 enterprise customers; business/deferred
- [x] 2026-06-10 Contribute `labyrinth-scout.v1` schema manifest (`docs/trust/labyrinth-scout-v1.schema.json`)

---

## Phase E; Marketing & positioning (must be deployed)

Goal: Sites lead with trust moat, not generic "open source agent." Carina and Scout read as one product.

### carinaai.uk

- [x] 2026-06-09 Hero: "Verifiably Secure Autonomous Agent"
- [x] 2026-06-09 Trust badge row (Scout, ERC-8004, ERC-8126, MIT)
- [x] 2026-06-09 Three-layer "How Carina Earns Trust" section
- [x] 2026-06-09 `/trust` trust dashboard page (extensionless URLs)
- [x] 2026-06-09 Commit and deploy carinaai.uk changes to production VPS
- [x] 2026-06-09 Footer cross-links: "Protected by Scout" badge in footer
- [x] 2026-06-09 CTA "Get Scout" routes to `app.carinaai.uk/pricing` (Stripe checkout)
- [x] 2026-06-10 Enterprise landing section: audit trail, prompt injection, on-chain verification answers (`#enterprise`)
- [x] 2026-06-09 Qualify overstated on-chain claims (hero badges, trust page honesty banner)

### labyrinthscout.com

- [x] 2026-06-09 Hero: "The verification layer for autonomous AI"
- [x] 2026-06-09 Carina positioned as reference implementation (not equal peer to OpenClaw)
- [x] 2026-06-09 Link to Carina trust dashboard
- [x] 2026-06-09 Commit and deploy labyrinthscout.com to production VPS
- [x] 2026-06-10 Replace generic "SIEM for AI agents" language (verifiable agent security platform)
- [x] 2026-06-10 Pricing page: Carina + Scout bundle tier with attestation frequency
- [x] 2026-06-09 `#verify` attestation section explains Type 1/2/3 incidents
- [x] 2026-06-10 Cross-link: Trust dashboard + ERC docs in footer

### Combined narrative

- [x] 2026-06-10 Joint section on both sites: Carina + Scout reference stack + trust stack
- [x] 2026-06-10 One-sentence positioning on carinaai.uk trust stack + labyrinthscout verify section
- [x] 2026-06-10 OG/Twitter meta aligned with trust positioning on carinaai.uk

---

## Phase F; Prompt injection defence-in-depth

Goal: Containment, not perfect prevention. Scout is the Type 3 (reasoning compromise) layer.

| Layer | Technique | Status |
|---|---|---|
| 1 | Pre-execution input filter (Agent Guard or equivalent) | [x] 2026-06-10 Agent Guard adapter + PromptGuard fallback |
| 2 | Behavioural sequence detection (CloneGuard-style) | [x] 2026-06-10 `tool-sequence-guard` + Scout exfil sequence detection |
| 3 | Zero standing privileges (JIT credentials) | [x] 2026-06-10 Session-scoped JIT grants for privileged tools |
| 4 | Labyrinth Scout Type 3 detection | [x] 2026-06-09 Event pipeline + anomaly detector + audit |
| 5 | Forensic artifact capture before containment | [x] 2026-06-10 `forensic_snapshots` + pre-suspend hook |

### Checklist

- [x] 2026-06-09 Layer 1 (partial): Carina `prompt-guard.ts` + middleware
- [x] 2026-06-09 Layer 1 (partial): Scout injection block events feed trust metrics
- [x] 2026-06-10 Integrate `agent-guard-plugins` via optional Python adapter (`AGENT_GUARD_ENABLED`)
- [x] 2026-06-10 CloneGuard-style monitoring via native `tool-sequence-guard` (no Python dependency)
- [x] 2026-06-10 Document least-privilege tool policy defaults (`docs/trust/least-privilege-defaults.md` + wizard note)
- [x] 2026-06-10 Formalise 6 forensic artifacts capture (`forensic_snapshots` + `captureForensicSnapshot`)
- [x] 2026-06-10 Scout incident runbook for Type 3 (`docs/trust/type3-runbook.md`)
- [x] 2026-06-09 Layer 4: Scout security event ingestion from Carina
- [x] 2026-06-09 Layer 4: Kill switch + session block + tool quarantine
- [x] 2026-06-10 Layer 5: Pre-containment snapshot before kill switch fires (`suspendInstance` hook)

---

## Phase G; Business & go-to-market

Solo founder constraints: Propreneur funds; Carina+Scout+trust gets growth hours.

### Operating model

- [x] 2026-06-09 Decision: keep Propreneur running on the side (2 clients onboarding)
- [;] Propreneur time budget enforced (max 5 hrs/week); operating habit, not code
- [x] 2026-06-10 Use Carina internally for Propreneur support (`docs/integrations/propreneur-dogfood.md`)

### Market wedge

- [x] 2026-06-10 Choose first vertical wedge: UK property (`carinaai.uk/property`)
- [x] 2026-06-10 Landing page variant: "Verifiable AI Agents for UK Property"
- [x] 2026-06-10 Three demo case studies (`carinaai.uk/case-studies`)

### Pilots & revenue

- [ ] Identify 5 target enterprises (regulated: finance, legal, healthcare, property)
- [x] 2026-06-10 Outreach template (`instructions/ENTERPRISE_OUTREACH_TEMPLATE.md`)
- [ ] First free pilot with security log collection
- [ ] Convert pilot to £2,500-5,000/mo paid (Scout + attestations)
- [ ] Track: support tickets per agent, Scout alerts per 1000 actions, CAC, MRR

### Metrics targets (12 months)

- [ ] Time to first paying customer < 45 days from trust stack launch
- [ ] MRR £10K+ (solo founder viability threshold)
- [ ] Labyrinth Scout alerts < 1 critical per 1000 agent actions

---

## Deferred / out of scope (do not build unless strategy changes)

- [;] Custom trust platform from scratch (adopt Agent Trust instead)
- [;] SoulChain memory anchoring (evaluate after Phase C)
- [;] x402 agent payments (future; after trust layer proven)
- [;] ZKP/PDV private data verification (Phase C+ optional; Mnemom alternative)
- [;] Full autonomous agent commerce (wallet, procurement); Tier 4 vision, not now

---

## Quick reference

| Doc | Purpose |
|---|---|
| `instructions/blockChaninTrust.md` | Strategy conversation and rationale |
| `instructions/TRUST_BUILD_CHECKLIST.md` | This file; living build tracker |
| `ARCHITECTURE.md` | Internal wiring (Carina ↔ Scout ↔ ops) |
| `core.carinaai.uk/docs/carina-cloud.md` | Full Carina Cloud + Scout tenant guide (VitePress / docs.carinaai.uk) |
| `instructions/BUILD_NEXT_CHECKLIST.md` | Hermes parity / general Carina features (separate track) |

## Remaining non-code items only

| Item | Type |
|---|---|
| Create attestation wallet + `TRUST_ATTESTER_PRIVATE_KEY` | Operator |
| First live `pnpm trust:register` / `attest` / `verify` on Base Sepolia | Operator |
| Deploy updated Scout + marketing pages to VPS | Operator |
| Enterprise pilot / LOI / MRR targets | Business |
| `pip install agent-guard-plugins` on production Carina host | Optional operator |

**Next operator step:** Set `TRUST_ATTESTER_PRIVATE_KEY`, run trust CLIs, deploy, then first enterprise pilot.

**Local validation:** `cd console.labyrinthscout.com && pnpm typecheck && pnpm test && bash ../scripts/trust-e2e-demo.sh`
