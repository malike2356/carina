# Scout + Carina Tool Architecture; Full Implementation Plan

> **REUSE RULE:** See `instructions/prompts/the_Ultimate_Carina_Upgrade/REUSE-RULES.md`. Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.

**Date:** 2026-06-17
**Reconciled:** 2026-06-19 (paths, phases, shipped vs planned verified against repo; includes findings API, SOC visibility, scout pull/investigate)
**Status:** PARTIAL IMPLEMENTATION; agent security shipped; attack-surface + compliance visibility groundwork in place
**Related:** `cyber-tools/` (68 tool prompts), `scout-soc-visibility.md`, `instructions/strategy/SCOUT-INDEPENDENCE.md`, `13-cyber-security-tools.md`, `README.md`
**Build Estimate:** ~22-26 weeks remaining for scan engines, Carina cyber wrappers, and launch polish (see Section 6)

---

## IMPLEMENTATION STATUS (reconciled 2026-06-19)

This document describes two overlapping products. Scout **already ships** as an agent security control plane plus SOC2 compliance visibility. The attack-surface scanning product (automated nmap/nuclei/etc., findings funnel, operator exploitation) is **partially built** (schema, APIs, Scout Score, Carina pull/investigate); scan engines and scheduler workers remain planned.

### Scout server (`console.labyrinthscout.com/`); EXISTING

| Area | Status | Code location |
|------|--------|---------------|
| Express server, port 4444 | Done | `console.labyrinthscout.com/src/server.ts` |
| Agent event ingestion | Done | `src/api/events.ts`, `src/api/heartbeat.ts` |
| Kill switch, quarantine, egress, JIT | Done | `src/api/kill.ts`, `src/api/quarantine.ts`, `src/api/egress-control.ts`, `src/api/jit-privileges.ts` |
| Prompt guard, honeypots, deception, policy | Done | `src/security/`, `src/deception/` |
| Trust API, attestations, governance | Done | `src/trust/`, `src/api/governance.ts`, `src/api/public-trust.ts` |
| Accounts, plan gating (Monitor vs Govern) | Done | `src/api/account.ts`, `src/middleware/plan-gate.ts`, `src/lib/subscription-plan.ts` |
| Static dashboard + checkout pages | Done | `console.labyrinthscout.com/public/` |
| Scheduler (trust, baselines, retention, compliance digest) | Done | `src/scheduler.ts`, `src/compliance/digest.ts` |
| Findings DB schema | Done | `src/migrations/add-findings-schema.ts` |
| Findings / targets / scans / score APIs | Done | `src/api/findings.ts`, `src/api/targets.ts`, `src/api/scans.ts`, `src/api/scout-score.ts` |
| Scout Score algorithm (attack-surface) | Done | `src/findings/score.ts` |
| SOC2 compliance visibility (schema + APIs) | Done | `src/migrations/add-compliance-visibility.ts`, `src/compliance/`, `src/api/compliance-soc.ts` |
| Compliance dashboard widget + trust center page | Done | `public/dashboard/js/widgets/compliance-soc.js`, `trust.labyrinthscout.com/index.html` |
| Weekly compliance digest cron | Done | `src/compliance/digest.ts`, `src/scheduler.ts` |
| Automated scan engines (nmap, nuclei, etc.) | **Planned** | No `src/engines/` directory |
| Scan job worker (queued → running → findings) | **Planned** | `queueScanRun()` inserts `status=queued` only; `src/findings/store.ts` |
| Per-target scan scheduler (cron) | **Planned** | `scan_configs` table exists; no worker reads `next_run_at` |
| Attack-surface dashboard UI | **Planned** | Current dashboard is agent-security focused |
| STIX export for CVE findings | **Planned** | SOC2 ZIP export shipped (`src/compliance/export.ts`); attack-surface STIX not built |
| Scout-owned billing (full independence) | **In progress** | See `instructions/strategy/SCOUT-INDEPENDENCE.md` |

### Carina core (`core.carinaai.uk/`); EXISTING

| Area | Status | Code location |
|------|--------|---------------|
| Scout client SDK (`@verlox/carina-scout`) | Done | `core.carinaai.uk/packages/scout-client/` |
| Scout telemetry shim | Done | `src/security/scout-client.ts`, `src/security/load-scout-package.ts` |
| Kill-switch listener (Redis) | Done | `src/security/kill-switch-listener.ts` |
| Scout policy client | Done | `src/security/scout-policy-client.ts` |
| CLI: `carina scout status\|test\|enable\|pair` | Done | `src/cli/commands/scout-cli.ts` |
| CLI: `carina scout pull\|investigate` | Done | `src/cli/commands/scout-findings-cli.ts`, `src/integrations/scout-findings-api.ts` |
| Findings REST client (attack surface) | Done | `src/integrations/scout-findings-api.ts` |
| Local investigation store (JSON files) | Done | `src/integrations/scout-investigations.ts` (`~/.carina/data/scout-investigations/`) |
| Tool suggestion engine for investigations | Done | `src/integrations/scout-tool-suggestions.ts` |
| TUI Scout overlay | Done | `src/tui/ink/components/scout/` |
| Billing plan IDs (scout_monitor, scout_pro) | Done | `src/billing/plans.ts` |
| Agent security layer (~67 files) | Done | `src/security/`, `src/sandbox/` |
| Cyber tool TypeScript wrappers | **Planned** | Prompts in `gap-05-security/cyber-tools/`; no `src/tools/security/` yet |
| CLI: deep-scan / report / watch / connect | **Planned** | Not in `scout-cli.ts` |
| `carina_investigations` Postgres table | **Planned** | Investigations are file-based today; no core DB migration |

### Prompt corpus; EXISTING (spec only)

| Area | Status | Location |
|------|--------|----------|
| 68 cyber tool prompts | Done (spec) | `gap-05-security/cyber-tools/` (55 markdown files; some bundle multiple tools) |
| 12 enterprise security prompts | Done (spec) | `gap-05-security/01-*.md` through `12-*.md` |
| Tool wrappers in Carina runtime | **Planned** | Prompts marked "Done" mean spec complete, not shipped code |

---

## EXECUTIVE SUMMARY

**Today:** Labyrinth Scout is a shipped Verlox SaaS product: agent security monitoring (prompt guard, kill switch, audit, trust API) plus SOC2 compliance visibility (score, auditor export, trust center, weekly digest). Carina connects via `@verlox/carina-scout` for telemetry and via `scout-findings-api.ts` for `pull`/`investigate`. Scout is agent-agnostic; Carina is one integration partner. See `instructions/strategy/SCOUT-INDEPENDENCE.md`.

**Target (this doc):** Scout also becomes an automated attack-surface product (~25 scheduled recon/vuln tools, findings API, Scout Score for external targets). Carina keeps all 68+ interactive offensive/forensic tools and validates findings for professional operators. Scout is top-of-funnel; Carina is the weapon.

**The split (in progress):** Scout ships agent security today. Attack-surface schema, CRUD APIs, Scout Score, SOC2 visibility layer, and Carina `pull`/`investigate` are shipped. Scan engines, scheduler workers, and exploitation CLI remain planned.

---

## 1. ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│              SCOUT (SaaS); console.labyrinthscout.com           │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │  SHIPPED TODAY       │    │  Scout Dashboard (static)     │    │
│  │                      │    │                              │    │
│  │  • Event ingestion   │    │  • Agent fleet status        │    │
│  │  • Kill switch       │───▶│  • Security events           │    │
│  │  • Prompt guard      │    │  • Trust / governance        │    │
│  │  • Honeypots         │    │  • Billing / accounts        │    │
│  │  • Policy / JIT      │    │  • SOC2 compliance widget    │    │
│  └──────────┬───────────┘    └──────────────┬───────────────┘    │
│             │                                 │                     │
│  ┌──────────▼───────────────────────────────▼───────────────┐    │
│  │  SHIPPED: SOC2 visibility            PARTIAL: Findings DB │    │
│  │  • compliance_controls/evidence      • targets             │    │
│  │  • auditor export + share links      • scan_runs (queued)  │    │
│  │  • trust center API + page           • findings (CRUD)     │    │
│  │  PLANNED: Scan engines               • scout_scores        │    │
│  │  • nmap, nuclei, amass, ...          • scan_configs (idle) │    │
│  └────────────────────────┬──────────────────────────────────┘    │
└───────────────────────────┼──────────────────────────────────────┘
                            │  Scout REST API (partial)
                            │  GET /api/findings
                            │  GET /api/targets, POST /api/targets/:id/scan
                            │  GET /api/score
                            │  (PARTIAL) PATCH /api/findings/:id + local JSON investigations
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                   CARINA (Operator Terminal)                    │
│                   core.carinaai.uk/; port 3333                 │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │  SHIPPED: Agent      │    │  SHIPPED: Scout integration  │    │
│  │  security + 71 tools │    │  carina scout status|test    │    │
│  │                      │    │  carina scout pull           │    │
│  │  PLANNED: 68 cyber   │    │  carina scout investigate    │    │
│  │  tool wrappers       │    │  PLANNED:                    │    │
│  │  (metasploit, etc.)  │    │  deep-scan, report, watch    │    │
│  │                      │    │  carina scout connect        │    │
│  └─────────────────────┘    └──────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Current Carina → Scout wire protocol (shipped):**

```
Carina  →  src/security/scout-client.ts  →  POST /api/events (port 4444)
Scout   →  Redis pub: labyrinth:control     →  src/security/kill-switch-listener.ts
```

**Planned Carina → Scout wire protocol (attack surface); PARTIAL:**

```
Carina  →  src/integrations/scout-findings-api.ts  →  GET /api/findings, /api/score
Carina  →  scout-findings-cli.ts (pull/investigate)  →  PATCH finding status, local JSON investigations
```

Still planned: deep-scan orchestration, evidence upload, `carina scout connect`, Postgres `carina_investigations`.

---

## 2. TOOL ASSIGNMENT MATRIX

Tool prompts live in `gap-05-security/cyber-tools/`. None have TypeScript wrappers in `core.carinaai.uk/src/tools/` yet. "Done" in `cyber-tools/README.md` means the prompt spec is written.

### 2.1 Scout Tools (25 Automated; SaaS Tier); PLANNED engines

| # | Tool | Category | Schedule | Scout Tier | Engine status |
|---|------|----------|----------|------------|---------------|
| 01 | nmap | Recon | Weekly | Monitor+ | Planned |
| 02 | amass | Recon | Daily | Monitor+ | Planned |
| 03 | theHarvester | OSINT | Weekly | Monitor+ | Planned |
| 05 | spiderfoot | OSINT | Weekly | Govern | Planned |
| 06 | sherlock | OSINT | Monthly | Govern | Planned |
| 11 | nuclei | Vuln | Daily | Monitor+ | Planned |
| 12 | nikto | Web Scan | Weekly | Monitor+ | Planned |
| 13 | wpscan | WP Scan | Weekly | Monitor+ | Planned |
| 15 | whatweb | Fingerprint | Weekly | Monitor+ | Planned |
| 14 | arjun | Param Discovery | Monthly | Govern | Planned |
| 16 | dirsearch | Content Discovery | Monthly | Monitor+ | Planned |
| 17 | feroxbuster | Content Discovery | Monthly | Govern | Planned |
| 18 | gobuster | Multi-Mode | Monthly | Monitor+ | Planned |
| 19 | ffuf | Web Fuzzing | Monthly | Govern | Planned |
| 20 | snort | IDS | Continuous | Govern | Planned |
| 21 | bloodhound | AD Mapping | Monthly | Govern | Planned |
| 23 | log2timeline | Timeline | On-Demand | Govern | Planned |
| 24 | timesketch | Timeline Search | On-Demand | Govern | Planned |
| 25 | yara | Malware Scan | Weekly | Govern | Planned |
| 71 | stix | Reporting | On-Demand | Monitor+ | Planned |
| 72 | cyberchef | Utility | On-Demand | Monitor+ | Planned |

**Scout plan tiers (monthly; shipped in `core.carinaai.uk/src/billing/plans.ts`):**

- **Monitor (`scout_monitor`, £49/mo):** Agent security dashboard, prompt injection detection, 14-day audit. Attack-surface tools above are **planned** add-ons for this tier.
- **Govern (`scout_pro`, £79/mo):** Everything in Monitor plus kill switch, honeypots, deception, 90-day audit, trust API. Govern-tier scan tools are **planned**.
- **Enterprise (`enterprise`, quote):** Custom targets, white-label, on-prem option, SSO, dedicated support.

**Carina plans (shipped):**

- **Self-Hosted (`free`, £0):** Full Carina terminal on your infrastructure. MIT core. Scout integration optional via API key.
- **Carina Ops Starter (`carina_ops_starter`, £19/mo):** Hosted ops console, BYOK, workbench.
- **Carina Ops Team (`carina_ops_team`, £49/mo):** Multi-user, deployments, 90-day audit.

**Combined (Carina + Scout):**

- Scout Monitor + Carina is the intended bundle at £49/mo; billing IDs exist but full `carina scout connect` flow is **planned**.
- Scout Govern at £79/mo maps to `scout_pro` in code (display name "Scout Govern").

**Scout with other agents:**

Same £49/£79 pricing. Requires manual API key config. Carina + Scout target is one-command pairing (`carina scout connect`); only `status`, `test`, `enable`, `pair` exist today.

### 2.2 Carina-Only Tools (47+; Interactive, Requires Operator); PLANNED wrappers

All listed tools have prompt specs in `cyber-tools/`. No `src/tools/security/` wrappers exist yet. High-risk tools require human approval in the planned design.

| # | Tool | Category | Risk | Why Not in Scout |
|---|------|----------|------|------------------|
| 04 | recon-ng | OSINT | Low | Interactive framework |
| 05 | maltego | Graph OSINT | Low | License-bound GUI |
| 08 | dmitry | Recon | Medium | Replaced by nmap in Scout |
| 09 | metagoofil | Metadata | Low | Niche document extraction |
| 10 | cewl | Wordlist | Low | Only used for exploitation |
| 16 | yersinia | L2 Attacks | High | Network disruption |
| 17 | legion | Pentest | Medium | Superseded by dedicated tools |
| 18 | metasploit | Exploitation | **Critical** | Requires human approval |
| 19 | impacket | Windows Exploit | **Critical** | Credential theft |
| 20 | hydra | Brute Force | **Critical** | Account lockout risk |
| 21 | john | Password Crack | High | Offline cracking |
| 22 | hashcat | GPU Crack | High | GPU-dependent |
| 23 | evil-winrm | Windows Shell | **Critical** | Remote access |
| 24 | crackmapexec | Lateral Movement | **Critical** | Domain-wide execution |
| 25 | mimikatz | Credential Dump | **Critical** | Credential theft |
| 26 | burpsuite | Web Testing | Medium | License-bound; interactive |
| 13 | sqlmap | SQLi | High | Exploitation |
| 32 | sstimap | SSTI | High | Exploitation |
| 33 | aircrack-ng | WiFi Audit | **Critical** | Illegal without permission |
| 34 | bettercap | MITM | **Critical** | Traffic interception |
| 35 | kismet | Wireless Scan | Low | Passive recon |
| 36 | wifite | WiFi Attack | **Critical** | Automated wireless attack |
| 37 | ettercap | MITM | **Critical** | Traffic interception |
| 38-53 | forensics suite | Forensics | Low-Med | Operator-driven case mgmt |
| 54-58 | traffic tools | Sniffing | Low-Critical | Interactive capture/analysis |
| 59-63 | privacy/opsec | OPSEC | Low-Med | Operator-only |
| 64-66 | RE tools | Reverse Eng | Low | Interactive analysis |

---

## 3. DATABASE SCHEMA

### 3.1 Scout findings schema; PARTIAL (shipped)

Migration: `console.labyrinthscout.com/src/migrations/add-findings-schema.ts`

Uses `account_id` (references `accounts`), not `org_id`. Shared Postgres default: `carina_central` (`SCOUT_DATABASE_URL` in `src/config/index.ts`).

```sql
-- Shipped tables (account-scoped)
targets          -- domain/ip/cidr per account
scan_configs     -- per-target tool schedule (schema only; no scheduler worker)
scan_runs        -- queued|running|completed|failed (queue inserts only today)
findings         -- CRUD via /api/findings
alerts           -- derived alerts (no dispatcher wired to attack-surface yet)
scout_scores     -- score snapshots via /api/score
```

### 3.2 SOC2 compliance visibility schema; DONE (shipped)

Migration: `console.labyrinthscout.com/src/migrations/add-compliance-visibility.ts`

Spec: `scout-soc-visibility.md`

```sql
-- Shipped tables (account-scoped)
compliance_controls           -- 31 SOC2 controls seeded
compliance_evidence           -- evidence rows per control (populated by gap-08 collectors; partial)
compliance_auditor_links      -- shareable auditor tokens
compliance_digest_subscriptions  -- weekly email digest opt-in
```

Combined security + compliance score: `GET /api/compliance/score` (`src/compliance/security-score.ts`).

**Planned additions (not migrated):**

```sql
-- organizations alias / Stripe fields on accounts (partial via accounts table today)
-- carina_investigations (Carina-side Postgres; planned in core.carinaai.uk)
-- Today: file-based JSON at ~/.carina/data/scout-investigations/ (scout-investigations.ts)
CREATE TABLE carina_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL,
  operator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'opened',
  tools_used TEXT[],
  sessions TEXT[],
  notes TEXT,
  evidence_path TEXT,
  chain_of_custody JSONB,
  stix_report_path TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
```

### 3.3 Original planning schema (superseded naming)

The 2026-06-17 draft used `organizations` and `org_id`. The shipped code uses `accounts` and `account_id`. New work should follow the shipped naming.

---

## 4. SCOUT REST API

### 4.1 Shipped endpoints (`console.labyrinthscout.com/src/server.ts`)

**Agent security (shipped):**

```
POST   /api/events              # Carina telemetry (primary integration today)
POST   /api/heartbeat
GET    /api/status
POST   /api/kill                # Scout Pro gate
POST   /api/quarantine          # Scout Pro gate
GET    /api/dashboard
GET    /api/audit
GET    /api/compliance          # Scout Pro gate
GET    /api/public/trust
... (policy, honeypots, deception, governance, etc.)
```

**Attack surface (partial):**

```
GET    /api/targets
POST   /api/targets
DELETE /api/targets/:targetId
POST   /api/targets/:targetId/scan    # queues scan_runs; no engine worker
GET    /api/findings
GET    /api/findings/:findingId
POST   /api/findings
PATCH  /api/findings/:findingId
GET    /api/scans
GET    /api/scans/:scanId
GET    /api/score
GET    /api/score/history             # if exposed via scout-score router
```

All attack-surface routes require `requireScoutPro` (Govern tier) except where noted in tests.

**SOC2 compliance visibility (shipped):**

```
GET    /api/compliance/score              # combined security + compliance score
POST   /api/compliance/export             # ZIP evidence bundle (archiver)
GET    /api/compliance/auditor-links      # list share links
POST   /api/compliance/auditor-links      # create share link
DELETE /api/compliance/auditor-links/:id
POST   /api/compliance/digest/subscribe   # weekly digest opt-in
GET    /api/public/compliance/trust-center
GET    /api/public/compliance/auditor/:token
GET    /audit/:token                      # public/audit.html
```

Merged into `src/api/compliance.ts` via `src/api/compliance-soc.ts`. Graceful `{ configured: false }` when evidence table missing.

### 4.2 Planned endpoints (not shipped)

```
GET    /api/v1/orgs/{org_id}/reports/latest
POST   /api/v1/orgs/{org_id}/reports/generate
GET    /api/v1/orgs/{org_id}/reports/{id}/stix
GET    /api/investigations
```

`POST /api/findings/:id/investigate` was not added; Carina `investigate` PATCHes `/api/findings/:id` directly and stores local case JSON.

The `/api/v1/orgs/...` prefix from the original draft was not adopted. Shipped routes use flat `/api/*` with account resolved from API key.

### 4.3 Authentication; shipped

```
- X-Scout-Key header or session cookie (dashboard)
- Account API keys scoped per Scout tenant
- Scout Pro plan gate for control-plane and attack-surface routes
- Carina operator tokens for /api/governance (operator auth middleware)
```

Rate limits per plan tier: **planned** (not enforced in findings routers today).

### 4.4 Webhook events; partial

Outbound alert webhooks (Discord, SMS) ship via `src/alerts/`. Finding-specific webhooks below are **planned**:

```json
{
  "new_critical_finding":     "A critical CVE or exposure discovered",
  "finding_severity_changed": "Finding upgraded/downgraded",
  "scan_completed":           "A scheduled scan finished",
  "new_target_discovered":    "Amass found a new subdomain",
  "score_changed":            "Scout Score dropped below threshold",
  "investigation_requested":  "Operator requested Carina investigation"
}
```

---

## 5. CARINA INTEGRATION; OPERATOR WORKFLOWS

### 5.1 CLI Commands

**Shipped (`core.carinaai.uk/src/cli/commands/scout-cli.ts`):**

```bash
carina scout status    # enabled flag, URL, health check
carina scout test      # POST test event via @verlox/carina-scout
carina scout enable    # prints setup instructions
carina scout pair      # points to carina setup / ops panel
```

**Shipped (`core.carinaai.uk/src/cli/commands/scout-findings-cli.ts`):**

```bash
carina scout pull [--severity] [--status] [--json] [--account-id]
carina scout investigate <finding_id>   # alias: inv
```

Uses `src/integrations/scout-findings-api.ts` (findings + score REST client). Investigations persist to `~/.carina/data/scout-investigations/` via `scout-investigations.ts`. Tool suggestions via `scout-tool-suggestions.ts`.

**Planned:**

```bash
carina scout connect <account_id>     # one-command pairing (docs reference; not implemented)
carina scout deep-scan <finding_id>
carina scout report <investigation_id>
carina scout watch <account_id>
```

### 5.2 Investigation Flow; PARTIAL

```
1. Operator sees Scout alert: "Critical CVE-2024-1234 on app.example.com:443"
2. carina scout pull                      # SHIPPED: lists open findings
3. carina scout investigate <finding_id>  # SHIPPED: PATCH status=investigating, local JSON case, tool suggestions
4. Operator validates with approval gate  # PLANNED: cyber tool wrappers not built
5. Results flow back to Scout finding status  # PARTIAL: manual PATCH only; no evidence upload API
6. STIX bundle for threat intel sharing     # PLANNED
```

---

## 6. BUILD PHASES (with status)

### Phase 0; Scout Agent Security; DONE

```
Shipped in console.labyrinthscout.com/:
  Event ingestion, kill switch, prompt guard, honeypots, deception
  Trust API, governance, accounts, static dashboard
  @verlox/carina-scout SDK, carina scout status|test|enable|pair
  Billing plan IDs: scout_monitor, scout_pro
```

### Phase 1; Scout Attack-Surface Infrastructure; PARTIAL (~45%)

```
DONE:
  PostgreSQL schema (targets, scan_configs, scan_runs, findings, alerts, scout_scores)
  REST API CRUD for findings, targets, scans, score
  Scout Score algorithm (src/findings/score.ts)
  Manual scan queue (inserts queued scan_runs)

REMAINING (Weeks 1-4 of original plan):
  Scan job worker (queued → running → completed)
  API key rate limiting per plan tier
  Finding webhooks
  Attack-surface dashboard views in public/
  DNS verification for target onboarding
  Scout-native Stripe checkout (per SCOUT-INDEPENDENCE.md)
```

### Phase 1b; SOC2 Compliance Visibility; DONE

```
Shipped per scout-soc-visibility.md:
  compliance_controls/evidence/auditor_links/digest_subscriptions tables
  src/compliance/ (scoring, security-score, export, auditor-links, trust-center, digest)
  API routes + public trust-center/auditor endpoints
  Dashboard widget (compliance-soc.js), trust.labyrinthscout.com/index.html
  Weekly digest cron (Monday 08:00 UTC in scheduler.ts)
```

### Phase 2; Scout Automated Engines; PLANNED (Weeks 5-8)

```
No src/engines/ directory. All 25 tool wrappers unbuilt.
  nmap, amass, theHarvester, whatweb, spiderfoot, sherlock
  nuclei, nikto, wpscan, ffuf, dirsearch, gobuster, feroxbuster, arjun
  snort, bloodhound, log2timeline, timesketch, yara
```

### Phase 3; Scout Scheduling & Scoring; PARTIAL (~30%)

```
DONE:   Scout Score algorithm + history table
PLANNED: Cron scheduler reading scan_configs.next_run_at
         Retry logic, failure alerts, WAF-aware rate limits
```

### Phase 4; Carina Integration Layer; PARTIAL (~35%)

```
DONE:
  Findings REST client (src/integrations/scout-findings-api.ts)
  carina scout pull / investigate (scout-findings-cli.ts)
  Local investigation store (scout-investigations.ts, JSON files)
  Tool suggestion engine (scout-tool-suggestions.ts)
  PATCH finding status → investigating on Scout

PLANNED:
  carina scout deep-scan / report / watch / connect
  carina_investigations Postgres table in core.carinaai.uk
  Bi-directional sync (evidence upload, closed-loop status)
  POST /api/findings/:id/investigate (optional Scout-side endpoint; Carina uses PATCH today)
```

### Phase 5; Carina Full Tool Suite; PLANNED (Weeks 15-24)

```
68 cyber tool prompts exist; 0 TypeScript wrappers in src/tools/security/.
Build order follows cyber-tools/README.md phases 1-11 (~24 weeks).
```

### Phase 6; Polish & Launch; PLANNED (Weeks 25-28)

```
End-to-end: add target → scan → finding → investigate → exploit → report
OpenAPI spec, customer docs, trial tier, beta customers
```

**Revised estimate:** Phase 0 and Phase 1b done. Phase 4 partial (~35%). Phases 1-3, 5-6 remaining ≈ 22-26 weeks for scan engines, Carina cyber wrappers, and launch polish.

---

## 7. DEPLOYMENT ARCHITECTURE

```
Contabo VPS (80.190.81.208); per core.carinaai.uk/deploy.sh

  ┌─────────────────────────────────────────────────┐
  │  nginx                                           │
  │  ├── carinaai.uk           → Carina :3000 (prod) │
  │  ├── core / gateway        → :3333 (local dev)  │
  │  ├── ops.carinaai.uk       → ops :4000 (dev)    │
  │  │                           ops :4002 (prod)   │
  │  ├── console.labyrinthscout.com → Scout :4444   │
  │  ├── trust.labyrinthscout.com  → trust center   │
  │  └── labyrinthscout.com    → marketing static   │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │  Labyrinth Scout (SHIPPED)         Port 4444     │
  │  console.labyrinthscout.com/                     │
  │  ├── Static dashboard (public/)                  │
  │  ├── REST API (Express)                          │
  │  ├── Scheduler (trust/baselines + compliance digest) │
  │  ├── Findings store (partial)                    │
  │  ├── Compliance visibility (shipped)             │
  │  └── PostgreSQL (carina_central / scout tables)  │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │  Carina (SHIPPED)                  Port 3333     │
  │  core.carinaai.uk/                               │
  │  ├── Core agent + 71 general tools               │
  │  ├── Scout telemetry via @verlox/carina-scout    │
  │  ├── scout pull / investigate (shipped)          │
  │  ├── PLANNED: 68 cyber tool wrappers             │
  │  └── PLANNED: deep-scan, report, watch, connect  │
  └─────────────────────────────────────────────────┘
```

**Note:** Port 3334 is Carina ACP (IDE), not Scout. The original draft's `scout:3334` and `scout.carinaai.uk` hostnames were never implemented. Scout lives at `console.labyrinthscout.com` on port 4444.

Docker reference: `core.carinaai.uk/docker-compose.verlox.yml` wires `SCOUT_URL: http://labyrinth-scout:4444`.

---

## 8. PRICING & BILLING

### Carina Plans (shipped; `core.carinaai.uk/src/billing/plans.ts`)

| Tier | ID | Price | Scout | Agent tools |
|------|-----|-------|-------|-------------|
| **Self-Hosted** | `free` | £0 | Optional API | 71 general tools (MIT) |
| **Ops Starter** | `carina_ops_starter` | £19/mo | No | + ops console |
| **Ops Team** | `carina_ops_team` | £49/mo | No | + multi-user, deployments |

### Scout Plans (shipped IDs; attack-surface features planned)

| Tier | ID | Price | Shipped today | Planned |
|------|-----|-------|---------------|---------|
| **Monitor** | `scout_monitor` | £49/mo | Agent dashboard, prompt guard, 14-day audit, compliance trust center API | + automated recon/vuln scans |
| **Govern** | `scout_pro` | £79/mo | Kill switch, honeypots, deception, trust API, SOC widget, auditor export | + full OSINT, fuzzing, IDS, forensics timeline |
| **Enterprise** | `enterprise` | Quote | SLA, on-prem option | Custom targets, white-label, SSO |

### Combined (Carina + Scout); planned go-to-market

| Tier | Price | What You Get |
|------|-------|-------------|
| **Monitor** | £49/mo | Cloud Carina + Scout Monitor; target `carina scout connect` |
| **Govern** | £79/mo | Full security platform |

Scout independence: customers should subscribe at `labyrinthscout.com` without Carina prerequisite. Full separation is **in progress** (`instructions/strategy/SCOUT-INDEPENDENCE.md`).

---

## 9. SCOUT ONBOARDING FLOW

**Shipped today (agent security):**

```
1. Customer lands on labyrinthscout.com
2. Checkout (partially via Carina billing; independence in progress)
3. Receives API key
4. Connects agent via LABYRINTH_ENABLED + LABYRINTH_API_KEY
5. Events appear in Scout dashboard
```

**Planned (attack surface):**

```
Add target domain → DNS verification → automated nmap+nuclei → findings dashboard → Scout Score
```

---

## 10. SUCCESS METRICS

Unchanged targets; none measured for attack-surface layer yet (no engines).

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time-to-first-finding | < 10 minutes | From signup to first CVE in dashboard |
| Scan reliability | > 99% | Successful scans / scheduled scans |
| False positive rate | < 5% | Confirmed FP / total findings |
| Scout Score accuracy | Correlation with actual risk | Customer breach vs score |
| Carina investigation time | < 2 hours | Finding opened → resolved/confirmed |
| Customer retention | > 90% monthly | Churn rate |
| NPS | > 60 | Post-onboarding survey |

---

## 11. REQUIREMENTS PER PROMPT

Every tool prompt in `gap-05-security/cyber-tools/` must produce:

1. **TypeScript wrapper** (`ToolDefinition`); typed parameters, risk level, `requiresApproval` flag
2. **CLI command**; `carina <category> <action> <target> [--flags]`
3. **Structured output**; JSON schema for parsing
4. **Workflow chains**; upstream/downstream tool connections
5. **Pitfalls**; per-tool edge cases and failure modes
6. **Verification**; `which` check + basic smoke test
7. **Scout eligibility flag**; `scout_eligible: true|false`
8. **Schedule default**; for Scout-eligible tools: `daily|weekly|monthly|continuous`
9. **Plan tier**; for Scout-eligible: `monitor|govern|enterprise`

Prompt specs satisfy 1-6 and 9 in prose. Items 7-8 and actual TypeScript wrappers are **planned**.

---

## 12. FILESYSTEM LAYOUT (reconciled)

```
/opt/lampp/htdocs/verlox/carina/

├── console.labyrinthscout.com/         # SHIPPED: Scout server (not scout/)
│   ├── src/
│   │   ├── api/                        # REST API (events + findings + compliance-soc)
│   │   ├── findings/                   # Findings store, score (partial)
│   │   ├── compliance/               # SOC2 visibility (shipped)
│   │   ├── security/                   # Prompt guard, policy, honeypots
│   │   ├── trust/                      # Trust API, attestations
│   │   ├── scheduler.ts                # Trust/baseline + compliance digest (not scan cron)
│   │   └── migrations/                 # add-findings-schema.ts, add-compliance-visibility.ts
│   ├── public/                         # Static dashboard, checkout, audit.html
│   └── package.json                    # labyrinth-scout, port 4444
│
├── core.carinaai.uk/                   # SHIPPED: Carina core
│   ├── packages/scout-client/          # @verlox/carina-scout SDK (event telemetry)
│   └── src/
│       ├── security/                   # ~67 files; scout-client.ts, kill-switch
│       ├── sandbox/                    # Execution isolation (shipped)
│       ├── integrations/
│       │   ├── scout-findings-api.ts   # Findings REST client (shipped)
│       │   ├── scout-investigations.ts # Local JSON investigation store (shipped)
│       │   └── scout-tool-suggestions.ts
│       ├── cli/commands/
│       │   ├── scout-cli.ts            # status|test|enable|pair (shipped)
│       │   └── scout-findings-cli.ts   # pull|investigate (shipped)
│       ├── tools/                      # 71 general tools; NO security/ subdir yet
│       └── billing/plans.ts            # scout_monitor, scout_pro IDs
│
├── trust.labyrinthscout.com/           # SHIPPED: public trust center static page
├── labyrinthscout.com/                 # SHIPPED: Scout marketing site
├── ops.carinaai.uk/                    # VERLOX private admin (port 4000/4002)
├── app.carinaai.uk/                    # Carina Cloud web app (workspace UI)
│
├── instructions/
│   ├── strategy/SCOUT-INDEPENDENCE.md  # Scout SaaS independence strategy
│   └── prompts/the_Ultimate_Carina_Upgrade/
│       ├── REUSE-RULES.md
│       └── gap-05-security/
│           ├── cyber-tools/            # 68 tool prompts (spec only)
│           ├── scout-soc-visibility.md # SOC2 visibility spec (implemented)
│           ├── 13-cyber-security-tools.md
│           ├── README.md               # Enterprise security master plan
│           └── SCOUT-CARINA-ARCHITECTURE.md  # THIS FILE
```

**Removed from plan (never created):**

- `scout/` standalone app directory
- `core.carinaai.uk/src/tools/security/scout-tools/`
- `core.carinaai.uk/src/integrations/scout-api.ts` (superseded by `scout-findings-api.ts` for attack surface)
- `scout.carinaai.uk` hostname (use `console.labyrinthscout.com`)

---

## APPENDIX: Quick Reference

### Scout ships to customers today:

Agent security monitoring: prompt guard, kill switch, audit, trust API, fleet dashboard. SOC2 compliance visibility (score, export, trust center, auditor links, weekly digest). Attack-surface schema/API groundwork (findings CRUD, Scout Score; no scan engines yet).

### Scout will ship (this doc):

Automated recon + vuln scanning + findings dashboard + STIX reports. Hands-off external-target SaaS.

### Carina ships to operators today:

Full autonomous agent, 71 tools, agent security layer, optional Scout telemetry. `carina scout pull` and `carina scout investigate` for findings workflow (local JSON investigations).

### Carina will ship (this doc):

68 cyber tool wrappers, deep-scan/report/watch/connect CLI, exploitation/forensics workflows.

### They connect today through:

`@verlox/carina-scout` → `POST /api/events` → kill switch via Redis.

`scout-findings-api.ts` → `GET/PATCH /api/findings`, `GET /api/score` → local investigation JSON files.

### They will connect through:

Full investigation loop: deep-scan orchestration, evidence upload, Postgres `carina_investigations`, STIX export.

### What never goes into Scout:

Exploitation, credential theft, MITM, wireless attacks, forensics, anti-forensics, reverse engineering, privacy tools. Operator-only.

### Build time:

Phase 0 and Phase 1b done. Phase 4 partial (~35%). Phases 1-3, 5-6: ~22-26 weeks for scan engines, Carina wrappers, and launch polish.
