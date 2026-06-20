# Labyrinth Scout; Complete Description

**Last updated:** 13 June 2026
**Status:** LIVE on Base Sepolia (ERC-8004 agent #6981, ERC-8126 verification active)
**Live at:** console.labyrinthscout.com (port 4444)
**Trust dashboard:** carinaai.uk/trust
**Marketing:** labyrinthscout.com

---

## What Labyrinth Scout Is

Labyrinth Scout is the **security and trust verification layer** for autonomous AI agents. It is:

- A **SIEM for AI agents**; real-time monitoring, threat detection, incident classification across Type 1 (runtime), Type 2 (privilege), and Type 3 (reasoning compromise) categories
- A **trust oracle**; security attestations anchored on the Base blockchain (ERC-8004 identity + ERC-8126 verification), verifiable by any third party
- **Governance infrastructure**; compliance exports (SOC2, ISO27001, EU AI Act), immutable audit logging, incident timelines, GDPR-compliant data handling
- A **commercial security product**; £79/mo (Basic) / £99/mo (Pro) / Enterprise tiers, 6-channel alerting, multi-tenant isolation
- **Open source (MIT)**; part of the `carina-ai` monorepo, installable independently or with Carina

Scout is NOT a separate company or product; it is the **security layer of Carina**, sharing the same codebase but independently deployable and sellable.

---

## Architecture

### Repository: `carina-ai/console.labyrinthscout.com/`

```
console.labyrinthscout.com/
├── src/
│   ├── alerts/                    # 6-channel alert dispatcher
│   │   ├── dispatcher.ts          # Central dispatch logic
│   │   ├── routing.ts             # Alert routing rules
│   │   ├── escalation.ts          # Escalation policy (SLA)
│   │   ├── throttle.ts            # Rate limiting for alerts
│   │   ├── templates.ts           # Alert message templates
│   │   ├── discord.ts             # Discord webhook
│   │   ├── email.ts               # Email via Resend
│   │   ├── slack.ts               # Slack webhook
│   │   ├── sms.ts                 # SMS gateway
│   │   ├── telegram.ts            # Telegram bot
│   │   ├── whatsapp.ts            # WhatsApp adapter
│   │   └── types.ts               # Alert types (breach/critical/warning/info)
│   │
│   ├── api/                       # 38+ API route modules
│   │   ├── account.ts             # Account registration, activation, login
│   │   ├── admin.ts               # Admin operations
│   │   ├── alert-channels.ts      # Alert channel CRUD
│   │   ├── anomalies.ts           # Anomaly queries and remediation
│   │   ├── attack-surface.ts      # Attack surface restrictions
│   │   ├── audit-search.ts        # Immutable audit log search
│   │   ├── auto-remediation.ts    # Auto-remediation rules
│   │   ├── block-session.ts       # Per-session blocking
│   │   ├── compliance.ts          # Compliance exports (SOC2/ISO27001/EU AI Act)
│   │   ├── dashboard.ts           # Main dashboard data (posture, agent-status, etc.)
│   │   ├── deception.ts           # Deception layer controls
│   │   ├── egress-control.ts      # Egress blocklist management
│   │   ├── events.ts              # Security event ingestion
│   │   ├── export.ts              # Audit log export (JSON/CSV)
│   │   ├── heartbeat.ts           # Agent heartbeat endpoint
│   │   ├── honeypots.ts           # Honeypot deployment and management
│   │   ├── incidents.ts           # Incident tracking and triage
│   │   ├── instances.ts           # Carina instance registry
│   │   ├── jit-privileges.ts      # JIT credential management
│   │   ├── kill.ts                # Kill switch execution
│   │   ├── killswitch-status.ts   # Kill switch state queries
│   │   ├── markers.ts             # Deception marker management
│   │   ├── memory-control.ts      # Agent memory inspection/clearing
│   │   ├── platform-settings.ts   # Platform-wide security settings
│   │   ├── policy.ts              # Security policy CRUD
│   │   ├── policy-evaluate.ts     # Policy evaluation engine
│   │   ├── policy-packs.ts        # Policy pack management
│   │   ├── provision.ts           # Auto-provisioning endpoint
│   │   ├── public-trust.ts        # Public trust API (no auth)
│   │   ├── quarantine.ts          # Tool quarantine controls
│   │   ├── rate-control.ts        # Rate limiting controls
│   │   ├── readiness.ts           # Service readiness check
│   │   ├── response-terminal.ts   # Response terminal data
│   │   ├── resume.ts              # Resume suspended agents
│   │   ├── simulation.ts          # Action simulation
│   │   ├── sse.ts                 # Server-Sent Events streaming
│   │   ├── stats.ts               # Statistics aggregation
│   │   ├── status.ts              # Agent status queries
│   │   ├── tripwires.ts           # Tripwire management
│   │   └── trust-enterprise.ts    # Enterprise trust features
│   │   └── trust-verify.ts        # Trust verification endpoints
│   │
│   ├── audit/                     # Immutable audit logging
│   │   ├── audit-logger.ts        # Write-ahead audit log
│   │   ├── audit-retention.ts     # Configurable retention policies
│   │   ├── audit-schemas.ts       # Event schemas
│   │   ├── audit-search.ts        # Full-text audit search
│   │   └── compliance/
│   │       ├── data-access-request.ts  # GDPR subject access
│   │       ├── data-deletion.ts        # GDPR right to erasure
│   │       ├── gdpr-report.ts          # GDPR compliance report
│   │       └── retention-policy.ts     # Data retention configuration
│   │
│   ├── dashboard/widgets/         # Server-rendered dashboard widgets
│   │   ├── agent-status.ts        # Agent status summary
│   │   ├── defense-console.ts     # Defense tab data model
│   │   ├── incident-ops.ts        # Incident triage metrics
│   │   ├── posture-summary.ts     # Full posture overview
│   │   ├── response-terminal.ts   # Response terminal summary
│   │   ├── threat-metrics.ts      # Threat metrics aggregation
│   │   └── usage-analytics.ts     # Token usage & tool analytics
│   │
│   ├── deception/                 # Deception layer
│   │   ├── deception-config.ts    # Deception settings
│   │   ├── decoy-generator.ts     # Fake credential/file generation
│   │   ├── decoy-tokens.json      # Decoy token patterns
│   │   ├── moving-target.ts       # Moving target deception markers
│   │   ├── rotation-scheduler.ts  # Marker rotation schedule
│   │   └── stale-marker-detector.ts  # Stale marker detection
│   │
│   ├── deploy/                    # Deployment tools
│   │   ├── deploy-command.ts      # Self-deployment commands
│   │   └── license-activator.ts   # License activation
│   │
│   ├── integration/               # Agent integration adapters
│   │   ├── adapter-registry.ts    # Adapter discovery
│   │   ├── agent-adapter.interface.ts  # Adapter interface
│   │   ├── scout-middleware.ts    # Express middleware
│   │   ├── scout-proxy.ts         # Reverse proxy
│   │   ├── scout-wrap.ts          # Agent wrapper
│   │   ├── security-pipeline.ts   # Policy pipeline
│   │   └── adapters/
│   │       ├── carina-adapter.ts      # Native Carina integration
│   │       ├── hermes-adapter.ts      # Hermes agent integration
│   │       ├── openclaw-adapter.ts    # OpenClaw integration
│   │       ├── langchain-adapter.ts   # LangChain middleware
│   │       ├── openai-adapter.ts      # OpenAI compatible
│   │       └── generic-adapter.ts     # REST API for any agent
│   │
│   ├── killswitch/                # Kill switch infrastructure
│   │   ├── global-kill-switch.ts  # Global kill state machine
│   │   ├── graceful-shutdown.ts   # Graceful shutdown coordination
│   │   └── kill-switch-audit.ts   # Kill switch audit trail
│   │
│   ├── proxy/                     # OpenAI-compatible proxy
│   │   └── openai-proxy.ts        # Transparent proxy with injection scanning
│   │
│   ├── security/                  # Core security engine
│   │   ├── action-simulator.ts    # "What-if" action simulation
│   │   ├── anomaly-detector.ts    # Statistical anomaly detection
│   │   ├── anomaly-types.ts       # Anomaly type definitions
│   │   ├── attack-surface.ts      # Attack surface restriction engine
│   │   ├── auto-remediation.ts    # Automatic response rules
│   │   ├── context-firewall.ts    # Context-level firewall
│   │   ├── egress-filter.ts       # DLP / egress filtering
│   │   ├── forensic-snapshot.ts   # Pre-containment forensic capture
│   │   ├── honeypot-manager.ts    # Honeypot lifecycle
│   │   ├── honeypot-prompt-block.ts  # Prompt injection honeypot
│   │   ├── injection-patterns.json   # Known injection signatures
│   │   ├── jit-privileges.ts      # Just-In-Time credential granting
│   │   ├── policy-decisions.ts    # Policy decision engine
│   │   ├── policy-gateway.ts      # Policy enforcement gateway
│   │   ├── policy-packs.ts        # Bundled security policies
│   │   ├── prompt-guard.ts        # Prompt injection shield
│   │   ├── risk-registry.ts       # Risk score registry
│   │   ├── risk-transitions.ts    # Risk state transitions
│   │   ├── session-shield.ts      # Session-level protection
│   │   ├── shield-report.ts       # Shield activity reports
│   │   ├── token-bucket.ts        # Rate limiting
│   │   ├── tool-policy.ts         # Tool-level policies
│   │   ├── tool-tiers.ts          # Tool risk tiering
│   │   └── tripwire-registry.ts   # Tripwire registration
│   │
│   ├── trust/                     # Blockchain trust layer
│   │   ├── attestation-adapter.ts     # Agent Trust adapter
│   │   ├── attestation-metrics.ts     # Attestation metric collection
│   │   ├── attestation-namespace.ts   # labyrinth-scout.v1 namespace
│   │   ├── build-public-trust.ts      # Public trust API payload
│   │   ├── chain-config.ts            # Chain configuration
│   │   ├── compliance-report.ts       # SOC2/ISO27001/EU AI Act PDF
│   │   ├── compute-trust-metrics.ts   # Risk score computation
│   │   ├── create-trust-sdk.ts        # Trust SDK factory
│   │   ├── incident-types.ts          # Type 1/2/3 classification
│   │   ├── load-trust-attestations.ts # Attestation history
│   │   ├── load-trust-identity.ts     # ERC-8004 identity loading
│   │   ├── register-erc8004.ts        # ERC-8004 registration
│   │   ├── risk-spike-monitor.ts      # Risk spike detection
│   │   ├── run-weekly-attestation.ts  # Weekly attestation job
│   │   ├── trust-alerts.ts            # Trust-related alerts
│   │   ├── trust-history.ts           # Attestation timeline
│   │   └── erc8126/
│   │       ├── compute-wav-score.ts       # WAV scoring
│   │       ├── compute-wv-score.ts        # WV scoring
│   │       ├── load-verifications.ts      # Verification loading
│   │       ├── run-weekly-verification.ts # Weekly verification job
│   │       ├── validation-registry.ts     # Validation registry
│   │       └── verification-types.ts      # Verification type definitions
│   │
│   ├── db.ts                      # Postgres connection pool
│   ├── redis.ts                   # Redis connection
│   ├── scheduler.ts               # Background job scheduler
│   ├── server.ts                  # Express server (entry point)
│   ├── migrations.ts              # Database migrations
│   └── types.ts                   # Shared TypeScript types
│
├── public/                        # Static assets
│   ├── dashboard.html             # Main Scout dashboard (2,634 lines)
│   ├── dashboard.js               # Dashboard JavaScript
│   ├── dashboard/js/widgets/      # 17 frontend widget modules
│   │   ├── action-queue.js
│   │   ├── agent-status.js
│   │   ├── attack-detail.js
│   │   ├── audit-log.js
│   │   ├── compliance-report.js
│   │   ├── dashboard-help.js
│   │   ├── defense-tab.js
│   │   ├── incident-timeline.js
│   │   ├── kill-switch.js
│   │   ├── live-feed.js
│   │   ├── posture-summary.js
│   │   ├── response-terminal.js
│   │   ├── threat-metrics.js
│   │   ├── trust-history.js
│   │   └── usage-analytics.js
│   ├── account/
│   │   ├── login.html, register.html, activate.html, dashboard.html
│   │   └── account.js, account.css
│   ├── index.html                 # Marketing landing page
│   ├── pricing.html               # Pricing page
│   ├── hub.css                    # Shared styles
│   └── favicon.svg                # Site icon
│
└── sdk/node/                      # Node.js client SDK
```

### Production Deployment

```
Contabo VPS (80.190.81.208)
└── /home/malike/apps/console.labyrinthscout.com/
    ├── dist/              # Compiled TypeScript
    ├── public/            # Static assets
    ├── .env               # Environment config
    └── node_modules/

Supervisor: labyrinth-scout (port 4444)
Access: console.labyrinthscout.com (nginx reverse proxy)
Auth: X-Scout-Key header for API; session-based for account portal
```

### Server Entry Point (src/server.ts)

The server is an Express application that:
1. Initializes PostgreSQL database with auto-migration
2. Syncs configured alert channels on startup
3. Connects to Redis
4. Starts SSE subscriber for real-time push
5. Launches background scheduler for periodic tasks (deception rotation, weekly attestation, risk checks)
6. Starts OpenAI-compatible transparent proxy
7. Mounts 38+ API route modules at versioned paths
8. Serves static assets and injects the Scout API key into the dashboard HTML

---

## Security Layers; Defence in Depth

Scout provides five-layer defence for autonomous AI agents:

### Layer 1: Pre-Execution Input Filter

**PromptGuard**; Three-stage injection detection:
1. **Regex pre-filter**; `injection-patterns.json` containing known injection signatures, matches within microseconds
2. **LLM judge**; Secondary model evaluates suspicious inputs for semantic injection attempts
3. **Tool result scanning**; Checks tool outputs for exfiltration patterns (API keys, PII in unexpected places)

Each blocked injection is reported to Scout with full context. Repeated blocks escalate severity automatically.

**Session Shield**; Per-session protection modes:
- `monitor`; Log everything, no blocking
- `restrict`; Block suspicious tools, allow others
- `quarantine`; Full isolation, all tools require operator approval

### Layer 2: Behavioural Sequence Detection

**Anomaly Detector**; Statistical monitoring of agent behaviour:
- Unusual tool usage patterns (z-score detection)
- Token consumption spikes
- Session duration anomalies
- Off-hours activity patterns
- Geographic/IP anomalies
- Repeated guard hits

**Tripwires**; Operator-configured thresholds that trigger on specific patterns:
- Tool call frequency thresholds
- Destination patterns
- Session parameter anomalies

### Layer 3: Zero Standing Privileges

**JIT (Just-In-Time) Credentials**; Credentials granted at session scope only:
- No persistent API keys in agent context
- Time-bound grants with automatic revocation
- Session-level scope isolation

### Layer 4: Labyrinth Scout Type 3 Detection

Reasoning compromise detection monitoring for:
- **Type 1**; Runtime incidents (tool misuse, unexpected output)
- **Type 2**; Privilege escalation (unauthorized tool access, credential misuse)
- **Type 3**; Reasoning compromise (model-level manipulation, prompt injection success)

### Layer 5: Forensic Capture

Pre-containment forensic snapshot captures full agent state before any kill action:
- Active tool calls
- Current context window
- Session metadata
- Memory state

---

## Deception Layer

The deception layer plants false targets to detect compromised agents:

### Honeypots
- **API key honeypots**; Fake OpenAI, Anthropic, and DeepSeek keys planted in agent context. Any access triggers immediate breach alert.
- **File honeypots**; Decoy credential files at `/tmp` and `data/` paths. Access triggers alert.
- **Custom honeypots**; Operator-deployable decoys via the dashboard.

### Moving Target Deception
- **Randomized markers**; Cryptographically random strings injected into the system prompt that rotate on schedule
- **Stale marker detection**; If an old marker appears in a new context, indicates replay or compromise attack
- **Rotation scheduler**; Background job rotates markers at configured intervals

### Decoy Tokens
`decoy-tokens.json` contains patterns for generating realistic-looking but invalid credentials across multiple providers.

---

## Egress Filtering (DLP)

Before any data leaves the agent to external services:

- **Allowlist-based URL enforcement**; Configurable outbound destination whitelist
- **Sensitive pattern scanning**; Credit card numbers, API keys, PII (passport, NHS numbers, email addresses)
- **Tool-specific egress rules**; Different rules per tool type
- **Block + alert**; Violations are blocked and reported to the operator
- **GUI-managed blocklist**; Add/remove destinations via the dashboard
- **Memory context filtering**; Blocks agent from sending memory contents to external services

---

## Kill Switch

Three levels of containment:

| Level | Scope | Effect |
|-------|-------|--------|
| **Global** | All instances | Immediate stop of all agent processes |
| **Per-instance** | Single agent | Isolate one compromised agent without affecting others |
| **Per-tool** | Specific tools | Block specific tool while keeping agent alive |

Features:
- **Graceful shutdown**; Completes in-flight operations, logs state, closes connections
- **Forensic snapshot**; Captures full agent state before containment
- **Audit trail**; Every kill action is logged immutably
- **Confirmation gate**; Operator must type "KILL" to confirm
- **Optional reason**; Record why the kill was executed

---

## Alerting System

### 6 Channel Adapters
- Discord (webhook)
- Email (Resend API)
- Slack (webhook)
- SMS
- Telegram (bot)
- WhatsApp

### Alert Severities

| Severity | Trigger | Response SLA |
|----------|---------|-------------|
| `breach` | Honeypot trigger, stale marker, confirmed credential leak | 15 min review, 30 min contain |
| `critical` | Kill switch fired, trust failure, repeated injection escalation | 30 min review, 1 hr contain |
| `warning` | Risk spike, single injection block, egress block | 4 hr review, next business day |
| `info` | Heartbeat gaps, routine shield blocks | 24 hr review, weekly summary |

### Escalation
Unacknowledged `breach` or `critical` events trigger secondary operator notification per SLA.

### Throttling
Alert rate limiting prevents notification storms. Configurable per-channel and per-severity.

---

## Audit Logging

- **Every tool call** logged: timestamp, user, session, parameters, result
- **Every model request** logged: prompt tokens, completion tokens, model, latency
- **Immutable audit trail**; write-ahead logging, cannot be deleted or modified by the agent
- **Configurable retention**; GDPR-compliant retention policies
- **Full-text search**; Search across all audit events
- **Export formats**; JSON and CSV
- **GDPR compliance**; Subject access requests, right to erasure, data portability

---

## Trust Layer; Blockchain Verification

### ERC-8004 Agent Identity
Every monitored agent can register a verifiable on-chain identity on Base:
- Unique on-chain ID per agent instance
- Public explorer link (basescan.org)
- Agent #6981 registered ("carina-reference")

### ERC-8126 Security Verification
Security scores computed and anchored on-chain:
- **WAV (Weighted Attestation Verification)**; Risk score from endpoint health + vulnerability scans
- **WV (Wallet Verification)**; Risk score from attestation wallet history
- **Unified risk score**; Mean of applicable verification scores (0-100, lower is better)

### labyrinth-scout.v1 Attestation Namespace
Custom attestation fields registered with Agent Trust:
- `securityScore` (0-100)
- `runtimeHours`; hours without critical incident
- `threatsDetected`; array of incident types
- `injectionBlocks`; prompt injection blocks in period
- `sandboxViolations`; sandbox escape attempts

### Public Trust API
`GET https://console.labyrinthscout.com/api/public/trust` (no authentication required)
Returns live risk scores, identity status, verification data, chain state, and data freshness.

### Trust Dashboard
`https://carinaai.uk/trust`; Public-facing dashboard with live risk score, ERC-8004 identity status, ERC-8126 explorer links, attestation history, and incident timeline.

---

## Agent Integration Adapters

Scout monitors any agent platform via adapters:

| Adapter | Integration Method |
|---------|-------------------|
| **Carina** | Native; same codebase, direct event ingestion |
| **Hermes** | Event ingestion adapter |
| **OpenClaw** | Event ingestion adapter |
| **LangChain** | Middleware adapter |
| **OpenAI** | Proxy adapter (no agent code changes) |
| **Generic** | REST API; any agent can POST events |

---

## OpenAI-Compatible Proxy

Scout operates a transparent OpenAI-compatible proxy. Agents configured to use it get:
- Automatic prompt injection scanning on every request
- Request/response logging
- Rate limiting per agent
- Cost tracking
- No agent code changes required; just point the API base URL to Scout's proxy endpoint

---

## Multi-Tenancy

- `account_id` scoping on every database table
- Per-account instance isolation
- Per-account alert channel configuration
- Per-account trust posture
- Per-account dashboard views

---

## The Dashboard

The Scout dashboard (`console.labyrinthscout.com/dashboard`) is a single-page application served as a 2,634-line HTML document with embedded CSS and JavaScript. It auto-injects the Scout API key on load. It presents a dark-themed terminal aesthetic with CRT boot animation, angular bracket panel corners, CRT scanlines, and green-on-dark colour scheme.

### Header Bar
Fixed header with:
- **LABYRINTH SCOUT** brand (amber monospace)
- **Live connection indicator**; green pulsing dot when connected
- **Instance ID** display
- **Admin operator** label
- **Last updated** timestamp
- **KILL SWITCH** button (red, opens confirmation modal)
- **YOUR SECURITY** link; Carina Cloud security portal
- **SCOUT ACCOUNT** link; Account portal
- **PUBLIC TRUST** link; Trust dashboard (carinaai.uk/trust, opens new tab)
- **Clock**; UTC time display

### Dashboard Tabs
Two views accessible via tab navigation at the top:

#### Tab 1: Overview

**Live Posture Section**; 6-metric grid displaying real-time state:
| Metric | Shows |
|--------|-------|
| **Risk Score** | 0-100 unified risk score with directional delta |
| **Agents Active** | Protected/total agent count |
| **Last Heartbeat** | Age of most recent agent telemetry |
| **Last Event** | Age of most recent security stream event |
| **Data Freshness** | Fresh/stale indicator + SSE subscriber count |
| **Kill Switch** | Armed/triggered state of control plane |

**Incident Triage Section**; 6-metric grid:
| Metric | Shows |
|--------|-------|
| **Open Critical** | Unresolved critical incidents |
| **Blocked (24h)** | Defensive actions taken |
| **Injection Blocks** | 24-hour shield blocks |
| **Acknowledged** | Incidents acknowledged + time-to-ack |
| **Runtime Unresolved** | Incidents needing triage |
| **Incident Rate** | Change vs prior 24 hours |

**Trust/Compliance Section**; 4-metric grid:
| Metric | Shows |
|--------|-------|
| **Last Attestation** | Age + ERC-8004 status |
| **Last Verification** | Age + ERC-8126 status |
| **Wallet** | Configured state + on-chain status |
| **Risk Tier** | Low/Medium/High/Critical tier label |

**Response Terminal**; Shows current shield mode, risk score, blocked actions, suspicious tools, and offers operator actions (kill, quarantine, restrict).

**Action Queue**; Ordered list of pending operator actions with severity-coded items.

**Attack Detail & Control Plane**; Three panels:
- **Top Tools (Blocked)**; Most-blocked tools with count bars
- **Top Blocked Destinations**; Most-frequently blocked outbound URLs
- **Control Plane**; Database status, Redis status, alert channels configured, deception enabled state, egress filter state, sandbox state, kill switch armed/triggered + Attacks by Type breakdown

**Admin Tier** (collapsible `<details>`); Four panels:
- **Estimated Token Usage**; Token consumption with progress bar
- **Immutable Audit Log**; Search input, export buttons, paginated event list with timestamps, severity, event type, and detail
- **Compliance Report**; JSON/PDF export buttons; Attestation History panel (on-chain timeline); Incident Timeline (filterable by Type 1/2/3)
- **Control Plane Settings**; Checkbox toggles for egress filter and sandbox, save button

**Three-Column Visualization Layout:**

**Left Column (25%)**
- **Threat Radar**; Animated canvas with concentric rings, 8 radial lines, rotating green sweep beam (20-degree arc), and threat dots that appear on severity-appropriate rings. Breach dots at outer ring, critical at 0.76R, warning at 0.52R, info at 0.28R. Dots blink for 3 seconds on appearance, fade over 20s, and pulse outward rings on impact.
- **Live Event Stream**; Scrollable feed of security events with coloured left borders (red=critical/breach, amber=warning, cyan=info), timestamps, severity badges, event type, and instance ID. Each row has hidden-on-hover action buttons: block session, throttle, add to blocklist, clear memory, lineage view. "Hide acknowledged" filter checkbox. Egress block count displayed in header.

**Middle Column (flex)**
- **Stat Cards**; Four severity counters (CRITICAL/WARNING/INFO/BREACH) with large glowing numbers, colour-coded bottom borders, and severity colours (red/amber/cyan/purple). Breach card has pulsing animation.
- **Event Frequency Chart**; 60-minute canvas histogram with colour-stacked bars (breach=red, critical=orange, warning=amber, info=cyan)
- **Anomaly Z-Score Chart**; 10-minute rolling anomaly detection plot
- **Tool Heatmap**; 24-hour tool usage intensity grid showing calls per tool per hour

**Right Column (24%)**
- **Severity Mix Donut**; Canvas donut chart showing proportion of event severities
- **Threat Level Gauge**; Canvas gauge with green-to-red arcs and needle
- **Top Event Types**; Canvas horizontal bar chart of most frequent event types

**Instances Bar**; Bottom bar showing all registered Carina instances with status dots (green=active, red=suspended, grey=offline), instance names, status labels, ages, and per-instance kill/resume buttons.

#### Tab 2: Defense

**Defense Context**; Session ID and Instance ID input fields with Refresh button.

**Response Summary**; Terminal-style summary of current defense state with operator action buttons.

**Defense Grid**; 8 cards:
| Card | Content |
|------|---------|
| **Shield Mode** | Current mode (monitor/restrict/quarantine), toggle controls |
| **Policy Packs** | Active and available security policy packs |
| **JIT Privileges** | Active Just-In-Time credential grants with expiry |
| **Action Simulation** | "What-if" simulator to preview policy outcomes |
| **Auto-Remediation** | Automated response rules, enable/disable toggles |
| **Tripwires** | Active tripwires with recent hit log |
| **Surface Restrictions** | Tool and destination restrictions per session |
| **Operator Action Log** | Audit trail of operator actions taken in this tab |

### Modals and Overlays

- **Kill Switch Modal**; Confirmation requiring operator types "KILL", optional reason field, execute button with red glow
- **Honeypot Deployment Modal**; Deploy fake API keys (OpenAI, Anthropic, DeepSeek) or credential files with one click
- **Session Memory Modal**; View active agent sessions with episodic memory turn counts. Clear memory button per session.
- **Egress Blocklist Modal**; View and unblock destinations from the egress filter
- **Tool Quarantine Modal**; Click individual tools to quarantine them for 60 minutes per instance
- **Export Modal**; Download audit log as JSON or CSV
- **Session Lineage Modal**; Trace session ancestry and event chains
- **Metric Help Modal**; Contextual help explaining each metric's meaning, trigger conditions, and recommended actions

### Real-Time Features

- **SSE (Server-Sent Events)**; Live event stream pushes new security events to the dashboard without polling
- **Auto-refresh**; All widgets poll their respective API endpoints every 5-15 seconds
- **Toast notifications**; Severity-coded popup notifications (critical/breach=red, warning=amber, info=cyan, ok=green)
- **Radar animation**; Continuous 60fps canvas animation for the threat radar
- **Gauge animation**; Smooth needle interpolation on threat level gauge
- **Grid pulse**; Red grid flash on breach events via CSS class toggling

---

## Current Status (June 2026)

| Component | Status |
|-----------|--------|
| Scout Server | LIVE (port 4444, supervisor: labyrinth-scout) |
| Dashboard | LIVE (console.labyrinthscout.com/dashboard) |
| Public Trust API | LIVE (returns real metrics) |
| ERC-8004 Identity | LIVE (agent #6981, Base Sepolia) |
| ERC-8126 Verification | LIVE (on-chain verification, Base Sepolia) |
| Prompt Injection Shield | LIVE (3-layer) |
| Kill Switch | LIVE (global + per-instance + per-tool) |
| Deception Layer | LIVE (honeypots + moving target markers) |
| Egress Filtering | LIVE (DLP + allowlist) |
| Audit Logging | LIVE (immutable, searchable, GDPR-compliant) |
| Alerting | CODE COMPLETE (6 channels; env vars need setting for email/telegram) |
| OpenAI Proxy | LIVE |
| Agent Integration Adapters | LIVE (6 platforms) |
| Enterprise Compliance Reports | LIVE (SOC2/ISO27001/EU AI Act PDF) |
| Base Mainnet | PENDING (testnet only; operator runs `pnpm trust:register:mainnet`) |
| Weekly Attestation | PENDING (code complete; awaiting 30-day clean window) |
| Enterprise Pilots | NONE (0 paying customers) |
| MRR | £0 (pre-revenue) |

---

## Key URLs

| URL | Purpose |
|-----|---------|
| https://console.labyrinthscout.com | Scout server |
| https://console.labyrinthscout.com/dashboard | Main dashboard |
| https://console.labyrinthscout.com/api/public/trust | Public trust API |
| https://labyrinthscout.com | Marketing site |
| https://carinaai.uk/trust | Public trust dashboard |
| https://core.carinaai.uk | Carina agent engine |

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `SCOUT_PORT` | Server port (default 4444) |
| `SCOUT_API_KEY` | API key for X-Scout-Key auth |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `TRUST_CHAIN_RPC` | Base RPC URL |
| `TRUST_ATTESTER_PRIVATE_KEY` | Attestation wallet private key (not yet set) |
| `SCOUT_ALERT_TO_EMAIL` | Alert destination email |
| `RESEND_API_KEY` | Resend API key for email alerts |
| `SCOUT_TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `SCOUT_TELEGRAM_CHAT_ID` | Telegram chat ID |
| `SCOUT_DISCORD_WEBHOOK_URL` | Discord webhook URL |
| `SCOUT_SLACK_WEBHOOK_URL` | Slack webhook URL |
| `TENANT_KEY_ENCRYPTION_KEY` | AES-256-CBC key for BYOK encryption |

---

## Build and Deploy

```bash
# Build
cd /opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com
pnpm build

# Deploy to VPS
rsync -avz --delete -e "ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519" \
  dist/ malike@80.190.81.208:/home/malike/apps/console.labyrinthscout.com/dist/
rsync -avz -e "ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519" \
  public/ malike@80.190.81.208:/home/malike/apps/console.labyrinthscout.com/public/

# Install and restart
ssh malike@80.190.81.208 "cd /home/malike/apps/console.labyrinthscout.com && npm install"
ssh malike@80.190.81.208 "sudo supervisorctl restart labyrinth-scout"

# Verify
curl -sI https://console.labyrinthscout.com/dashboard | head -3
curl -s https://console.labyrinthscout.com/api/public/trust | jq .risk_score
```
