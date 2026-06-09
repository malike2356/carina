# Trust Stack Build Checklist

Living tracker for the Carina + Labyrinth Scout + Blockchain trust moat described in `blockChaninTrust.md`.

**Last updated:** 2026-06-10  
**Current phase:** Release 1 (MVP combined product) — ~85% complete  
**Strategy:** Adopt Agent Trust on Base; Labyrinth Scout as security attestation oracle; do not build a custom trust platform.

---

## How to use this file

1. Pick the next unchecked item in order (top to bottom within each phase unless blocked).
2. When you ship it (code merged, tests pass, deployed if applicable), change `[ ]` to `[x]` and add the date: `[x] 2026-06-09`.
3. If partially done, use `[~]` and note what remains on the same line.
4. Update the **Last updated** date and **Current phase** summary at the top.
5. Do not mark marketing items complete until they are committed and deployed to production.

**Status key:** `[x]` done | `[~]` partial | `[ ]` not started | `[—]` cancelled/deferred

---

## Progress summary

| Phase | Focus | Done | Total | % |
|---|---|---:|---:|---:|
| A | Foundation (Carina + Scout integration) | 18 | 18 | 100% |
| B | Release 1 — MVP + off-chain trust dashboard | 14 | 16 | 88% |
| C | Release 2 — On-chain attestations (ERC-8004/8126) | 0 | 14 | 0% |
| D | Release 3 — Enterprise trust layer + revenue | 0 | 10 | 0% |
| E | Marketing & positioning (deployed) | 7 | 12 | 58% |
| F | Prompt injection defence-in-depth | 6 | 10 | 60% |
| G | Business & go-to-market | 1 | 8 | 13% |

---

## Phase A — Foundation (Carina + Scout integration)

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

## Phase B — Release 1 (weeks 1–6): Combined MVP + off-chain trust

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

- [ ] Register reference Carina agent on ERC-8004 (Base Sepolia testnet) — see Phase C.1
- [ ] One paying enterprise pilot OR signed LOI for Carina + Scout bundle
- [ ] End-to-end demo: Carina action → Scout event → trust dashboard risk score update

---

## Phase C — Release 2 (weeks 7–12): On-chain attestations

Goal: Labyrinth Scout posts real security attestations on-chain. Risk score backed by verifiable proofs.

### C.1 — ERC-8004 agent identity (Base Sepolia → Base mainnet)

- [ ] Choose and document trust platform: Agent Trust (`@open-agent-economy/trust-sdk`) on Base
- [ ] Add chain dependencies (viem or ethers) to `console.labyrinthscout.com`
- [ ] Create Scout attestation wallet; store key in env (never commit)
- [ ] Document env vars: `TRUST_CHAIN_RPC`, `TRUST_ATTESTER_PRIVATE_KEY`, `TRUST_ERC8004_REGISTRY`
- [ ] Register reference Carina agent on ERC-8004 Identity Registry (Base Sepolia)
- [ ] Store `agentId` + tx hash in Scout DB (`carina_instances` or new `trust_identities` table)
- [ ] Expose ERC-8004 agent ID + explorer link on public trust API
- [ ] Flip `TRUST_ERC8004_STATUS=live` only after testnet registration confirmed
- [ ] Mainnet registration (Base) after testnet validation

### C.2 — Agent Trust security attestation adapter

- [ ] Install `@open-agent-economy/trust-sdk` in Scout
- [ ] Define custom namespace `labyrinth-scout.v1` with fields: `securityScore`, `runtimeHours`, `threatsDetected`, `injectionBlocks`, `sandboxViolations`
- [ ] Build `LabyrinthScoutAttestationAdapter` (Scout findings → Agent Trust `submitAttestation`)
- [ ] Schedule weekly attestation job (not per-event; cost control)
- [ ] Post attestation on clean runtime (30d no critical incidents)
- [ ] Store attestation UID + tx hash in Scout DB
- [ ] Expose attestation explorer links on public trust API (replace hash previews with on-chain refs)
- [ ] Tests with mocked SDK (never hit mainnet in CI)

### C.3 — ERC-8126 verification (WAV + WV)

- [ ] Implement WAV risk score from Scout endpoint health + vulnerability scan findings
- [ ] Implement WV risk score from attestation wallet on-chain history
- [ ] Submit ERC-8126 verification attestations to Validation Registry
- [ ] Unified risk score (mean of applicable verification scores) on trust API
- [ ] Flip `TRUST_ERC8126_STATUS=live` after first successful on-chain verification
- [ ] Link to `erc8126.ai` reference implementation docs from trust page

### C.4 — Release 2 exit criteria

- [ ] Trust page shows real Base explorer links for identity + latest attestation
- [ ] Pilot customer uses production agent with on-chain attestation visible
- [ ] Marketing claim "on-chain attestations" is factually true in production

---

## Phase D — Release 3 (weeks 13–20): Enterprise trust layer

Goal: Self-serve compliance exports, historical attestations, premium revenue. Target £5K+ MRR.

- [ ] Scout console: Attestation History panel (per agent, all ERC-8126 proofs)
- [ ] Scout console: Compliance Report Generator (one-click PDF for auditors)
- [ ] Scout console: Incident Timeline (Type 1 runtime escape, Type 2 privilege escape, Type 3 reasoning compromise)
- [ ] Trust-gating API: `GET /api/trust/verify/:agentId` for third-party services
- [ ] Enterprise tier: configurable attestation frequency (daily/weekly)
- [ ] Enterprise tier: SOC2 / ISO27001 / EU AI Act readiness export pack
- [ ] Open source Carina core; charge for Scout + on-chain attestations (pricing aligned across sites)
- [ ] Self-serve onboarding: register → pair Carina → first attestation within 7 days
- [ ] Revenue target: £5K+ MRR from 2–3 enterprise customers
- [ ] Contribute `labyrinth-scout.v1` schema upstream to Agent Trust ecosystem

---

## Phase E — Marketing & positioning (must be deployed)

Goal: Sites lead with trust moat, not generic "open source agent." Carina and Scout read as one product.

### carinaai.uk

- [x] 2026-06-09 Hero: "Verifiably Secure Autonomous Agent"
- [x] 2026-06-09 Trust badge row (Scout, ERC-8004, ERC-8126, MIT)
- [x] 2026-06-09 Three-layer "How Carina Earns Trust" section
- [x] 2026-06-09 `/trust` trust dashboard page (extensionless URLs)
- [x] 2026-06-09 Commit and deploy carinaai.uk changes to production VPS
- [x] 2026-06-09 Footer cross-links: "Protected by Scout" badge in footer
- [x] 2026-06-09 CTA "Get Scout" routes to `app.carinaai.uk/pricing` (Stripe checkout)
- [ ] Enterprise landing section: audit trail, prompt injection, on-chain verification answers
- [x] 2026-06-09 Qualify overstated on-chain claims (hero badges, trust page honesty banner)

### labyrinthscout.com

- [x] 2026-06-09 Hero: "The verification layer for autonomous AI"
- [x] 2026-06-09 Carina positioned as reference implementation (not equal peer to OpenClaw)
- [x] 2026-06-09 Link to Carina trust dashboard
- [x] 2026-06-09 Commit and deploy labyrinthscout.com to production VPS
- [ ] Replace generic "SIEM for AI agents" language everywhere
- [ ] Pricing page: Carina + Scout bundle tier with attestation frequency
- [ ] `#verify` attestation section explains Type 1/2/3 incidents
- [ ] Cross-link: "Trust verified on-chain via ERC-8004/8126"

### Combined narrative

- [ ] Single joint landing page or section: "Carina + Labyrinth Scout = verifiable agent stack"
- [ ] One-sentence positioning live on both sites: "Other agents ask you to trust them. Carina proves it."
- [ ] OG/Twitter meta aligned with trust positioning (some Twitter tags still say old copy)

---

## Phase F — Prompt injection defence-in-depth

Goal: Containment, not perfect prevention. Scout is the Type 3 (reasoning compromise) layer.

| Layer | Technique | Status |
|---|---|---|
| 1 | Pre-execution input filter (Agent Guard or equivalent) | [~] Scout/Carina prompt-guard exists; Agent Guard plugin not integrated |
| 2 | Behavioural sequence detection (CloneGuard-style) | [ ] Not integrated |
| 3 | Zero standing privileges (JIT credentials) | [~] Tool policy + Scout gating partial; full JIT not built |
| 4 | Labyrinth Scout Type 3 detection | [x] 2026-06-09 Event pipeline + anomaly detector + audit |
| 5 | Forensic artifact capture before containment | [~] Audit log exists; full 6-artifact capture not formalised |

### Checklist

- [x] 2026-06-09 Layer 1 (partial): Carina `prompt-guard.ts` + middleware
- [x] 2026-06-09 Layer 1 (partial): Scout injection block events feed trust metrics
- [ ] Evaluate `agent-guard-plugins` for pre-LLM filter integration
- [ ] Evaluate CloneGuard for tool-sequence monitoring
- [ ] Document least-privilege tool policy defaults in setup wizard
- [ ] Formalise 6 forensic artifacts capture spec (prompt history, RAG provenance, tool sequence, identity, downstream agents, LLM trace)
- [ ] Scout incident runbook for Type 3 reasoning compromise
- [x] 2026-06-09 Layer 4: Scout security event ingestion from Carina
- [x] 2026-06-09 Layer 4: Kill switch + session block + tool quarantine
- [ ] Layer 5: Pre-containment snapshot before kill switch fires

---

## Phase G — Business & go-to-market

Solo founder constraints: Propreneur funds; Carina+Scout+trust gets growth hours.

### Operating model

- [x] 2026-06-09 Decision: keep Propreneur running on the side (2 clients onboarding)
- [ ] Propreneur time budget enforced (max 5 hrs/week; batch support Tue/Thu)
- [ ] Use Carina internally for Propreneur support/reporting (dogfood)

### Market wedge

- [ ] Choose first vertical wedge (doc suggested UK property via existing PropCalc/Propreneur credibility)
- [ ] Landing page variant: "Verifiable AI Agents for UK Property"
- [ ] Three case studies (even synthetic/demo) showing Carina + Scout value

### Pilots & revenue

- [ ] Identify 5 target enterprises (regulated: finance, legal, healthcare, property)
- [ ] Outreach template emphasising on-chain verifiability (once Phase C ships)
- [ ] First free pilot with security log collection
- [ ] Convert pilot to £2,500–5,000/mo paid (Scout + attestations)
- [ ] Track: support tickets per agent, Scout alerts per 1000 actions, CAC, MRR

### Metrics targets (12 months)

- [ ] Time to first paying customer < 45 days from trust stack launch
- [ ] MRR £10K+ (solo founder viability threshold)
- [ ] Labyrinth Scout alerts < 1 critical per 1000 agent actions

---

## Deferred / out of scope (do not build unless strategy changes)

- [—] Custom trust platform from scratch (adopt Agent Trust instead)
- [—] SoulChain memory anchoring (evaluate after Phase C)
- [—] x402 agent payments (future; after trust layer proven)
- [—] ZKP/PDV private data verification (Phase C+ optional; Mnemom alternative)
- [—] Full autonomous agent commerce (wallet, procurement) — Tier 4 vision, not now

---

## Quick reference

| Doc | Purpose |
|---|---|
| `instructions/blockChaninTrust.md` | Strategy conversation and rationale |
| `instructions/TRUST_BUILD_CHECKLIST.md` | This file — living build tracker |
| `ARCHITECTURE.md` | Internal wiring (Carina ↔ Scout ↔ ops) |
| `core.carinaai.uk/docs/carina-cloud.md` | Full Carina Cloud + Scout tenant guide (VitePress / docs.carinaai.uk) |
| `instructions/BUILD_NEXT_CHECKLIST.md` | Hermes parity / general Carina features (separate track) |

**Next unchecked item:** Phase B exit criteria — end-to-end demo + first pilot. Phase C.1 — ERC-8004 testnet registration.
