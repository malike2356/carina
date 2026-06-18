# Scout + Carina Tool Architecture; Full Implementation Plan

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Date:** 2026-06-17
**Status:** PLANNING; Ready for development
**Related:** `cyber-tools/` (72 tool prompts), `SCOUT-INDEPENDENCE.md`, `13-cyber-security-tools.md`
**Build Estimate:** 28 weeks (7 months) for full implementation

---

## EXECUTIVE SUMMARY

Scout is the automated, customer-facing SaaS security product. Carina is the operator-driven terminal with full offensive/forensic capability. Together they form a two-tier product: Scout finds problems automatically and sells subscriptions; Carina validates and exploits them for professional operators.

**The split:** Scout ships with ~25 automated tools. Carina keeps all 72. They communicate through a shared Findings API. Scout is top-of-funnel. Carina is the weapon.

---

## 1. ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│                        SCOUT (SaaS)                              │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │  Automated Engines   │    │  Scout Dashboard              │    │
│  │                      │    │                              │    │
│  │  • nmap (weekly)     │    │  • Attack Surface Map        │    │
│  │  • nuclei (daily)    │───▶│  • CVE List (ranked)         │    │
│  │  • amass (daily)     │    │  • Subdomain Inventory       │    │
│  │  • nikto (weekly)    │    │  • Open Ports                │    │
│  │  • ffuf (monthly)    │    │  • Endpoint Discovery        │    │
│  │  • wpscan (weekly)   │    │  • Technology Stack          │    │
│  │  • whatweb (weekly)  │    │  • Alert History             │    │
│  │  • spiderfoot (wkly) │    │  • Scout Score (0-100)       │    │
│  │  • theHarvester (wk) │    │  • Auto-Generated Reports    │    │
│  │  • sherlock (monthly)│    │  • STIX Export               │    │
│  │  • snort (continuous)│    │  • Billing / Subscription    │    │
│  │  • dirsearch (month) │    │  • Team Management           │    │
│  │  • gobuster (month)  │    │  • API Keys                  │    │
│  │  • feroxbuster (mo)  │    │                              │    │
│  └──────────┬───────────┘    └──────────────┬───────────────┘    │
│             │                               │                     │
│  ┌──────────▼───────────────────────────────▼───────────────┐    │
│  │                 Shared Findings Database                  │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │    │
│  │  │ findings     │  │ targets      │  │ scan_runs       │  │    │
│  │  │ • id         │  │ • id         │  │ • id            │  │    │
│  │  │ • target_id  │  │ • domain/ip  │  │ • target_id     │  │    │
│  │  │ • tool       │  │ • org_id     │  │ • tool          │  │    │
│  │  │ • severity   │  │ • plan_tier  │  │ • started_at    │  │    │
│  │  │ • cvss       │  │ • created_at │  │ • completed_at  │  │    │
│  │  │ • raw_data   │  │ • tags       │  │ • status        │  │    │
│  │  │ • status     │  │              │  │ • findings_cnt  │  │    │
│  │  │ • created_at │  │              │  │                 │  │    │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │    │
│  └────────────────────────┬──────────────────────────────────┘    │
└───────────────────────────┼──────────────────────────────────────┘
                            │  Scout REST API
                            │  GET /api/v1/findings
                            │  GET /api/v1/targets/{id}/findings
                            │  POST /api/v1/findings/{id}/investigate
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                        CARINA (Operator Terminal)                 │
│                                                                  │
│  ┌─────────────────────┐    ┌──────────────────────────────┐    │
│  │  Interactive Tools   │    │  Operator Workflows           │    │
│  │                      │    │                              │    │
│  │  EXPLOITATION        │    │  carina scout pull           │    │
│  │  • metasploit        │    │  → Fetch findings from Scout │    │
│  │  • hydra             │    │                              │    │
│  │  • john/hashcat      │    │  carina scout investigate <id>│   │
│  │  • impacket          │    │  → Deep-dive on finding      │    │
│  │  • crackmapexec      │    │                              │    │
│  │  • mimikatz           │    │  carina exploit validate <id>│   │
│  │  • evil-winrm        │    │  → Attempt exploitation       │    │
│  │                      │    │                              │    │
│  │  FORENSICS           │    │  carina forensic timeline    │    │
│  │  • dc3dd, autopsy    │    │  carina report stix          │    │
│  │  • volatility3       │    │  carina report generate      │    │
│  │  • sleuthkit         │    │                              │    │
│  │  • yara, foremost    │    │                              │    │
│  │  • regripper         │    │                              │    │
│  │  • ghidra, radare2   │    │                              │    │
│  │                      │    │                              │    │
│  │  WIRELESS / NETWORK  │    │                              │    │
│  │  • aircrack-ng       │    │                              │    │
│  │  • bettercap         │    │                              │    │
│  │  • ettercap          │    │                              │    │
│  │  • kismet            │    │                              │    │
│  │                      │    │                              │    │
│  │  PRIVACY / OPSEC     │    │                              │    │
│  │  • anonsurf, tor     │    │                              │    │
│  │  • mat2, bleachbit   │    │                              │    │
│  └─────────────────────┘    └──────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. TOOL ASSIGNMENT MATRIX

### 2.1 Scout Tools (25 Automated; SaaS Tier)

| # | Tool | Category | Schedule | Scout Tier | Purpose |
|---|------|----------|----------|------------|---------|
| 01 | nmap | Recon | Weekly | All plans | Port scan + service detection |
| 02 | amass | Recon | Daily | Operator+ | Subdomain enumeration |
| 03 | theHarvester | OSINT | Weekly | Operator+ | Email/subdomain OSINT |
| 02 | amass | Recon | Daily | Monitor+ | Subdomain enumeration |
| 03 | theHarvester | OSINT | Weekly | Monitor+ | Email/subdomain OSINT |
| 04 | spiderfoot | OSINT | Weekly | Govern | Full automated OSINT |
| 06 | sherlock | OSINT | Monthly | Govern | Username search |
| 12 | nikto | Web Scan | Weekly | Monitor+ | Web server assessment |
| 13 | wpscan | WP Scan | Weekly | Monitor+ | WordPress security |
| 14 | arjun | Param Discovery | Monthly | Govern | Hidden parameter discovery |
| 15 | dirsearch | Content Discovery | Monthly | Monitor+ | Directory enumeration |
| 16 | feroxbuster | Content Discovery | Monthly | Govern | Recursive content find |
| 17 | gobuster | Multi-Mode | Monthly | Monitor+ | Dir/DNS/VHOST busting |
| 18 | ffuf | Web Fuzzing | Monthly | Govern | Fast endpoint fuzzing |
| 19 | snort | IDS | Continuous | Govern | Intrusion detection (if logs piped) |
| 20 | bloodhound | AD Mapping | Monthly | Govern | AD attack path analysis |
| 23 | log2timeline | Timeline | On-Demand | Govern | Super timeline creation |
| 24 | timesketch | Timeline Search | On-Demand | Govern | Timeline query/visualize |
| 25 | yara | Malware Scan | Weekly | Govern | Malware pattern matching |

**Scout plan tiers (monthly):**
- **Monitor (£49/mo):** nmap, whatweb, nuclei, cyberchef, stix, amass, theHarvester, nikto, wpscan, dirsearch, gobuster, ffuf
- **Govern (£79/mo):** + spiderfoot, sherlock, arjun, feroxbuster, snort, bloodhound, log2timeline, timesketch, yara; plus compliance reports, immutable audit trail, RBAC
- **Enterprise (Quote):** Custom targets, white-label, on-prem deployment option, SSO, dedicated support

**Carina plans:**
- **Self-Hosted (£0):** Full Carina terminal on your own infrastructure. All 72 tools. No Scout integration. No cloud infrastructure costs.
- **Cloud (£20/mo):** Carina on Carina infrastructure. Covers infra + metered token usage. No Scout included. All 72 tools.

**Combined (Carina + Scout):**
- **Monitor (£49/mo):** Cloud Carina + Scout Monitor. Best integration; one command to link. Automated recon + vuln scanning + dashboard.
- **Govern (£79/mo):** Cloud Carina + Scout Govern. Everything in Monitor plus compliance, audit, RBAC, advanced forensics.

**Scout with other agents (Hermes, OpenClaw, etc.):**
- Same £49/£79 pricing. But requires manual config, API key plumbing, and no auto-import. Carina + Scout is one command: `carina scout connect`.

### 2.2 Carina-Only Tools (47; Interactive, Requires Operator)

| # | Tool | Category | Risk | Why Not in Scout |
|---|------|----------|------|------------------|
| 04 | recon-ng | OSINT | Low | Interactive framework |
| 05 | maltego | Graph OSINT | Low | License-bound GUI |
| 08 | dmitry | Recon | Medium | Replaced by nmap in Scout |
| 09 | metagoofil | Metadata | Low | Niche document extraction |
| 10 | cewl | Wordlist | Low | Only used for exploitation |
| 15 | yersinia | L2 Attacks | High | Network disruption |
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
| 32 | sstimap | SSTI | High | Exploitation |
| 33 | aircrack-ng | WiFi Audit | **Critical** | Illegal without permission |
| 34 | bettercap | MITM | **Critical** | Traffic interception |
| 35 | kismet | Wireless Scan | Low | Passive recon (Scout alternative exists) |
| 36 | wifite | WiFi Attack | **Critical** | Automated wireless attack |
| 37 | ettercap | MITM | **Critical** | Traffic interception |
| 38 | autopsy | Forensics | Low | Operator-driven case mgmt |
| 39 | volatility3 | Memory Forensics | Low | Interactive analysis |
| 40 | dc3dd | Disk Imaging | Low | Chain of custody |
| 41 | sleuthkit | FS Forensics | Low | Interactive analysis |
| 42 | binwalk | Firmware | Low | Specialized firmware extraction |
| 43 | ghidra | Reverse Eng | Low | Interactive decompilation |
| 44 | bulk-extractor | Data Extract | Low | Niche bulk extraction |
| 46 | guymager | Forensic Image | Low | GUI-driven imaging |
| 47 | rekall | Memory Forensics | Low | Alternative to Volatility |
| 48 | foremost | File Carving | Low | Niche deleted file recovery |
| 49 | plasmo | Timeline | Low | Operator-driven |
| 50 | xplico | Network Forensics | Low | Niche pcap decoding |
| 51 | regripper | Registry | Low | Interactive registry analysis |
| 52 | hashdeep | Hash Audit | Low | Interactive verification |
| 53 | ollydbg | Debugger | Medium | Interactive binary debugging |
| 54 | tshark | Traffic Analysis | Low | Interactive pcap analysis |
| 55 | tcpdump | Packet Capture | Low | Interactive capture |
| 56 | dsniff | Credential Sniff | **Critical** | Traffic interception |
| 57 | responder | LLMNR Poison | **Critical** | Credential harvesting |
| 58 | scapy | Packet Craft | Medium | Custom packet manipulation |
| 59 | anonsurf | Tor Routing | Medium | OPSEC tool |
| 60 | tor | Anonymity | Low | OPSEC infrastructure |
| 61 | mat2 | Metadata Strip | Low | OPSEC tool |
| 62 | bleachbit | Anti-Forensics | Medium | Evidence destruction |
| 63 | gparted | Disk Partition | High | Destructive operation |
| 64 | radare2 | Reverse Eng | Low | Interactive analysis |
| 65 | cutter | RE GUI | Low | GUI-only |
| 66 | vscodium | IDE | Low | Development tool |

---

## 3. DATABASE SCHEMA

### 3.1 Shared Scout Database

```sql
-- Organizations (Scout customers)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('monitor', 'govern', 'enterprise')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Targets (domains/IPs being monitored)
CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  target TEXT NOT NULL,            -- domain or IP
  target_type TEXT NOT NULL CHECK (target_type IN ('domain', 'ip', 'cidr')),
  label TEXT,                      -- "Production", "Staging"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, target)
);

-- Scan configurations (per-target, per-tool scheduling)
CREATE TABLE scan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id),
  tool TEXT NOT NULL,              -- 'nmap', 'nuclei', 'amass', etc.
  schedule TEXT NOT NULL,          -- cron expression or 'daily','weekly','monthly'
  is_enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',       -- tool-specific params
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scan execution runs
CREATE TABLE scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id),
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  findings_count INTEGER DEFAULT 0,
  error_message TEXT,
  raw_output_path TEXT,            -- S3/local path to raw tool output
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Findings (the core data product)
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id UUID NOT NULL REFERENCES scan_runs(id),
  target_id UUID NOT NULL REFERENCES targets(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  tool TEXT NOT NULL,
  finding_type TEXT NOT NULL,       -- 'open_port', 'cve', 'subdomain', 'misconfig', etc.
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  cvss_score DECIMAL(3,1),
  title TEXT NOT NULL,
  description TEXT,
  remediation TEXT,
  raw_data JSONB NOT NULL,          -- Full tool output for this finding
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','confirmed','false_positive','resolved')),
  is_new BOOLEAN DEFAULT true,      -- True if first occurrence
  first_seen TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts (derived from findings)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  finding_id UUID NOT NULL REFERENCES findings(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('new_critical','severity_change','new_target','scan_complete')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scout Score (per-org health metric)
CREATE TABLE scout_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  open_critical INTEGER DEFAULT 0,
  open_high INTEGER DEFAULT 0,
  open_medium INTEGER DEFAULT 0,
  open_low INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Carina Investigations Table (Carina-side)

```sql
-- Carina investigation tracking
CREATE TABLE carina_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL,          -- References Scout finding
  operator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'opened' CHECK (status IN ('opened','in_progress','exploit_attempted','exploit_successful','remediated','closed')),
  tools_used TEXT[],                 -- ['metasploit', 'hydra', 'crackmapexec']
  sessions TEXT[],                   -- Meterpreter/shell session IDs
  notes TEXT,
  evidence_path TEXT,                -- Screenshots, logs
  chain_of_custody JSONB,            -- Forensic chain
  stix_report_path TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
```

---

## 4. SCOUT REST API

### 4.1 Endpoints

```
# Findings
GET    /api/v1/orgs/{org_id}/findings          # List findings (filterable)
GET    /api/v1/orgs/{org_id}/findings/{id}     # Single finding detail
PATCH  /api/v1/orgs/{org_id}/findings/{id}     # Update finding status

# Targets
GET    /api/v1/orgs/{org_id}/targets           # List monitored targets
POST   /api/v1/orgs/{org_id}/targets           # Add target
DELETE /api/v1/orgs/{org_id}/targets/{id}      # Remove target
POST   /api/v1/orgs/{org_id}/targets/{id}/scan # Trigger manual scan

# Scans
GET    /api/v1/orgs/{org_id}/scans             # Scan run history
GET    /api/v1/orgs/{org_id}/scans/{id}        # Single scan detail

# Score
GET    /api/v1/orgs/{org_id}/score             # Current Scout Score
GET    /api/v1/orgs/{org_id}/score/history     # Score over time

# Reports
GET    /api/v1/orgs/{org_id}/reports/latest    # Latest auto-generated report
POST   /api/v1/orgs/{org_id}/reports/generate  # Generate custom report
GET    /api/v1/orgs/{org_id}/reports/{id}/stix # STIX export

# Carina Integration
POST   /api/v1/findings/{id}/investigate       # Flag finding for Carina investigation
GET    /api/v1/investigations                  # List investigations (Carina-side)
```

### 4.2 Authentication

```
- API Keys per organization (generated in Scout dashboard)
- API keys per organization (generated in Scout dashboard)
- Carina operator tokens (separate auth domain)
- All requests: Authorization: Bearer *** Rate limits per plan tier:
  - Monitor: 60 req/min
  - Govern: 300 req/min
  - Enterprise: 1000 req/min
```

### 4.3 Webhook Events

Scout fires webhooks to Carina (and optionally to customer systems):

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

```bash
# Pull latest Scout findings for an org
carina scout pull <org_id>
  → Fetches all open findings from Scout API
  → Displays: severity breakdown, new since last pull, Scout Score

# Investigate a specific finding
carina scout investigate <finding_id>
  → Pulls full finding data
  → Suggests relevant Carina tools
  → Opens investigation session
  → Example: "CVE-2024-xxx on nginx 1.24; suggest: nuclei validate, metasploit exploit/multi/http/nginx_xxx"

# Deep scan triggered from finding
carina scout deep-scan <finding_id>
  → Runs the full recon → vuln → exploit chain
  → nmap service scan → nuclei targeted → metasploit validation
  → Updates Scout finding with results

# Report back
carina scout report <investigation_id>
  → Generates STIX report
  → Pushes findings back to Scout
  → Updates finding status

# Continuous monitoring mode
carina scout watch <org_id>
  → Polls Scout API every 5 minutes
  → Alerts operator on new critical findings
  → Auto-opens investigations for critical CVEs
```

### 5.2 Investigation Flow

```
1. Operator sees Scout alert: "Critical CVE-2024-1234 on app.example.com:443"

2. carina scout investigate <finding_id>
   Carina pulls:
   - Target details (IP, domain, service, version)
   - CVE details (description, CVSS, known exploits)
   - Previous scan history
   - Related findings (same host, same CVE elsewhere)

3. Carina suggests:
   carina exploit suggest nginx 1.24.0
   → "3 exploits available: exploit/multi/http/nginx_..."

4. Operator (with approval):
   carina exploit validate CVE-2024-1234 --target app.example.com
   → nuclei validation scan
   → metasploit dry-run check
   → If confirmed: exploit attempt (with --approval flag)

5. Results flow back to Scout:
   - Finding status: open → confirmed
   - Evidence: screenshot, log, session output
   - Remediation: "Upgrade nginx to 1.25.0"

6. Auto-generated STIX bundle for threat intel sharing
```

---

## 6. BUILD PHASES

### Phase 1; Scout Core Infrastructure (Weeks 1-4)

```
Week 1-2: Database & API
   PostgreSQL schema (organizations, targets, scan_configs, scan_runs, findings, alerts)
   Scout REST API (CRUD for all entities)
   API key auth + rate limiting
   Webhook system

Week 3-4: Scout Dashboard
   Organization onboarding (add domain, verify ownership)
   Attack surface dashboard (open ports, subdomains, CVEs)
   Finding list with filtering (severity, tool, date, status)
   Scout Score widget
   Alert bell + notification preferences
   Reports page (auto-generated, STIX export)
   Billing integration (Stripe plan tiers)
   Team management (invite members, RBAC)
```

### Phase 2; Scout Automated Engines (Weeks 5-8)

```
Week 5-6: Recon Engines
   nmap wrapper (scheduled, scoped)
   amass wrapper (passive + active modes)
   theHarvester wrapper
   whatweb wrapper
   spiderfoot integration (headless)
   sherlock wrapper (rate-limited)

Week 7-8: Vuln + Web Engines
   nuclei wrapper (with template auto-update)
   nikto wrapper
   wpscan wrapper
   ffuf wrapper (dir + vhost modes)
   dirsearch / gobuster / feroxbuster
   arjun parameter discovery
   snort integration (log ingestion pipeline)
   bloodhound-python integration
```

### Phase 3; Scout Scheduling & Scoring (Weeks 9-10)

```
Week 9: Scheduler
   Cron-based job scheduler
   Per-target, per-tool scheduling
   Rate limiting (respect target WAFs)
   Retry logic + failure alerts
   scan_runs tracking

Week 10: Scoring Engine
   Scout Score algorithm:
      - Base 100
      - -10 per critical CVE
      - -5 per high CVE
      - -2 per medium
      - -1 per open port without vuln
      - +5 if resolved within SLA
   Score history tracking
   Score trend graph
```

### Phase 4; Carina Integration Layer (Weeks 11-14)

```
Week 11-12: Scout → Carina API
   POST /investigate endpoint
   Investigation tracking in Carina DB
   STIX report generation pipeline
   Evidence upload (screenshots, logs, pcaps)

Week 13-14: Carina Scout CLI
   carina scout pull / investigate / deep-scan / report / watch
   Finding → tool suggestion engine
   Auto-investigation for critical CVEs (with approval gate)
   Bi-directional sync (Carina findings → Scout updates)
```

### Phase 5; Carina Full Tool Suite (Weeks 15-24)

```
Week 15-16: Exploitation Tools (metasploit, impacket, hydra, john, hashcat)
Week 17-18: Post-Exploitation (crackmapexec, mimikatz, evil-winrm, bloodhound deep)
Week 19-20: Forensics Pipeline (autopsy, volatility3, dc3dd, sleuthkit, regripper)
Week 21-22: Wireless + Network (aircrack-ng, bettercap, kismet, wireshark/tshark)
Week 23-24: RE + Privacy + Reporting (ghidra, radare2, anonsurf, mat2, stix, cyberchef)
```

### Phase 6; Polish & Launch (Weeks 25-28)

```
Week 25: Testing & QA
   End-to-end: add target → scan → finding → investigate → exploit → report
   Rate-limit testing across plan tiers
   False-positive baseline measurement
   Performance benchmarks (scans/sec, findings/sec)

Week 26: Documentation
   Scout customer docs (onboarding, dashboard, reports, API)
   Carina operator docs (CLI, tool workflows, investigation playbooks)
   API reference (OpenAPI spec)

Week 27: Deployment
   Scout: Contabo VPS, port 3334 (alongside core on 3333, ops on 4001)
   Carina: existing Contabo deployment
   Shared PostgreSQL (carina_central_scout or new DB)
   Nginx reverse proxy + SSL
   Monitoring + alerting

Week 28: Launch
   Stripe subscription live
   Scout marketing site update (carinaai.uk/scout or scout.carinaai.uk)
   Trial tier (14-day free, limited to 1 target)
   Operator onboarding flow
   First 10 beta customers
```

---

## 7. DEPLOYMENT ARCHITECTURE

```
Contabo VPS (80.190.81.208)

  ┌─────────────────────────────────────────────────┐
  │  nginx                                           │
  │  ├── carinaai.uk          → core.carinaai.uk:3333│
  │  ├── ops.carinaai.uk      → ops.carinaai.uk:4001 │
  │  ├── scout.carinaai.uk    → scout:3334 (NEW)     │
  │  └── api.scout.carinaai.uk→ scout:3334/api       │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │  Scout (NEW)                   Port 3334         │
  │  ├── Dashboard (React/Next.js)                   │
  │  ├── REST API (Express/Fastify)                  │
  │  ├── Scheduler (node-cron)                       │
  │  ├── Tool Engines (TypeScript wrappers)          │
  │  └── PostgreSQL (scout_db)                       │
  └─────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │  Carina (Existing)             Port 3333         │
  │  ├── Core agent                                  │
  │  ├── All 72 tool wrappers                        │
  │  ├── Scout integration (CLI + API client)        │
  │  └── carina_central (shared DB)                  │
  └─────────────────────────────────────────────────┘
```

---

## 8. PRICING & BILLING

### Carina Plans

| Tier | Price | Infrastructure | Scout | All 72 Tools |
|------|-------|---------------|-------|-------------|
| **Self-Hosted** | £0 | Your own | Failed:  | Done:  |
| **Cloud** | £20/mo | Ours | Failed:  | Done:  |

- **Self-Hosted:** Full Carina terminal. Install on your machine. All 72 security tools. No Scout integration. You manage infra, tokens, and updates.
- **Cloud:** Carina runs on Carina infrastructure. Covers hosting + metered token usage. No Scout included.

### Scout Plans (with any agent)

| Tier | Price | Tools | Features |
|------|-------|-------|----------|
| **Monitor** | £49/mo | 12 tools | Attack surface dashboard, CVEs, Scout Score, STIX export, subdomain monitoring, web scanning |
| **Govern** | £79/mo | 25 tools | + Full OSINT, deep fuzzing, IDS, AD mapping, forensics timeline, compliance reports, immutable audit trail, RBAC |
| **Enterprise** | Quote | Custom | Custom targets, white-label, on-prem deployment option, SSO, dedicated support, SLA |

### Combined (Carina Cloud + Scout)

| Tier | Price | What You Get |
|------|-------|-------------|
| **Monitor** | £49/mo | Cloud Carina + Scout Monitor. `carina scout connect`; one command. |
| **Govern** | £79/mo | Cloud Carina + Scout Govern. Full security platform. |

### Scout with Other Agents

Same £49/£79 pricing whether you connect Hermes, OpenClaw, Odysseus, or any other agent. But:
- **Carina + Scout:** One command. `carina scout connect`. Auto-import. Built for each other.
- **Other agents + Scout:** Manual API key config. Custom plumbing. Webhook setup. No auto-import.

### Why Carina + Scout Wins
Carina and Scout were built as one system. With Carina, `carina import from-hermes` pulls your entire setup, then `carina scout connect` links Scout in one command. You get the investigation pipeline; Scout finds, Carina exploits, everything auto-documented to your Obsidian vault. With other agents, you're doing API integration manually.

### Revenue Model

```
Scout (standalone or with any agent):
  - 50 Monitor   × £49  = £2,450/mo
  - 30 Govern    × £79  = £2,370/mo
  - 5 Enterprise × £500 = £2,500/mo (estimated)
  Scout MRR: £7,320/mo

Carina Cloud (without Scout):
  - 100 users    × £20  = £2,000/mo
  Carina MRR: £2,000/mo

Combined MRR target: £9,320/mo at 185 customers
```

---

## 9. SCOUT ONBOARDING FLOW

```
1. Customer lands on scout.carinaai.uk
2. Chooses plan (Monitor/Govern) or starts with Cloud Carina (£20/mo) or Self-Hosted (free)
3. Creates account (email + password or Google OAuth)
4. Adds first target domain
5. DNS verification (TXT record or file upload)
6. Stripe payment
7. First scan begins automatically (nmap + nuclei, ~5 min)
8. Dashboard populates with initial findings
9. Welcome email with:
   - Dashboard overview
   - First findings summary
   - Scout Score
   - "What to do next" guide
10. Automated weekly report begins
```

---

## 10. SUCCESS METRICS

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

Every tool prompt in `cyber-tools/` must produce:

1. **TypeScript wrapper** (ToolDefinition); with typed parameters, risk level, requiresApproval flag
2. **CLI command**; `carina <category> <action> <target> [--flags]`
3. **Structured output**; JSON schema for parsing
4. **Workflow chains**; upstream/downstream tool connections
5. **Pitfalls**; per-tool edge cases and failure modes
6. **Verification**; `which` check + basic smoke test
7. **Scout eligibility flag**; `scout_eligible: true|false`
8. **Schedule default**; for Scout-eligible tools: `daily|weekly|monthly|continuous`
9. **Plan tier**; for Scout-eligible: `monitor|govern|enterprise`

---

## 12. FILESYSTEM LAYOUT

```
/opt/lampp/htdocs/verlox/carina/

├── scout/                              # NEW: Scout standalone app
│   ├── src/
│   │   ├── api/                        # REST API
│   │   ├── dashboard/                  # React dashboard
│   │   ├── engines/                    # 25 automated tool wrappers
│   │   ├── scheduler/                  # Cron-based scan scheduler
│   │   ├── scoring/                    # Scout Score algorithm
│   │   ├── db/                         # Migrations + models
│   │   └── billing/                    # Stripe integration
│   ├── .env
│   └── package.json
│
├── core.carinaai.uk/                   # EXISTING: Carina core
│   └── src/
│       ├── tools/security/             # All 72 tool wrappers
│       │   ├── scout-tools/            # 25 Scout-eligible
│       │   └── carina-only/            # 47 interactive-only
│       ├── cli/
│       │   └── commands/
│       │       └── scout.ts            # NEW: carina scout CLI
│       └── integrations/
│           └── scout-api.ts            # NEW: Scout REST client
│
├── instructions/
│   └── gaps-5-partial-closing/
│       └── security-gold-standard/
│           ├── cyber-tools/            # 72 tool prompts (EXISTING)
│           ├── 13-cyber-security-tools.md
│           └── SCOUT-CARINA-ARCHITECTURE.md  # THIS FILE
│
└── SCOUT-INDEPENDENCE.md               # EXISTING: Scout product strategy
```

---

## APPENDIX: Quick Reference

### Scout ships to customers:
Automated recon + vuln scanning + dashboard + reports. Hands-off SaaS.

### Carina ships to operators:
Full terminal with exploitation, forensics, wireless, RE. Requires human judgment.

### They connect through:
Scout REST API → `carina scout` CLI → investigation pipeline → shared findings DB.

### What never goes into Scout:
Exploitation, credential theft, MITM, wireless attacks, forensics, anti-forensics, reverse engineering, privacy tools. These are operator-only.

### Build time:
28 weeks. Phase 1-3 (Scout core + engines): 10 weeks. Phase 4-5 (Carina integration + full tools): 14 weeks. Phase 6 (polish + launch): 4 weeks.