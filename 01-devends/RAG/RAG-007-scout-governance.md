# Scout Governance Layer

## What Scout Is

Labyrinth Scout is the security and trust verification layer for autonomous AI agents. It is a
SIEM (Security Information and Event Management) system purpose-built for AI agent monitoring.

Scout is not a standalone product in the sense that it requires Carina to function. It is
architecturally independent: Scout can monitor any AI agent that implements the Scout event
ingestion API, whether that agent runs on Carina, LangChain, CrewAI, or a custom implementation.
However, Carina integrates Scout natively at the channel layer (`channel-scout-signals.ts`) and
the tool execution layer.

Scout's codebase is at `02-backends/console.labyrinthscout.com/`. It is a separate service
running on port 4444, deployed as `verlox/scout` Docker image.

## Key Files and Structure

```
console.labyrinthscout.com/src/
  api/                    57 API route modules
  alerts/                 6-channel alert dispatcher
    discord.ts, email.ts, slack.ts, sms.ts, telegram.ts, whatsapp.ts
    dispatcher.ts         Central dispatch logic
    routing.ts            Alert routing rules
    escalation.ts         Escalation policy and SLA
    throttle.ts           Rate limiting for alerts
    templates.ts          Alert message templates
```

## Threat Classification

Scout classifies threats into three types:

**Type 1 (Runtime):** Abnormal agent behaviour during execution. Examples: unexpected tool calls,
resource exhaustion, tool execution outside normal working hours, excessive API calls, unusual
memory access patterns.

**Type 2 (Privilege):** Permission boundary violations. Examples: agent attempting to access
data outside its assigned workspace, lateral movement to other tenants, JIT credential misuse,
attempt to disable Scout monitoring.

**Type 3 (Reasoning Compromise):** The agent's decision-making has been altered adversarially.
Examples: prompt injection via user input, jailbreak patterns detected in incoming messages,
adversarial instructions embedded in documents the agent processed (indirect injection),
tool results containing injected instructions.

## Core Capabilities

### Kill Switch
The most important single feature. One API call (`POST /api/kill`) or one button in the Scout
console halts every registered Carina agent instantly via Redis pub/sub. The kill state is
persisted in Redis so agents that restart also check and respect it.

Recovery requires an explicit resume (`POST /api/resume`) with operator authentication. This is
not auto-recoverable. The design intent: when something goes wrong with an AI agent in production,
you need to be absolutely certain you can stop it before investigating.

### Immutable Audit Trail
Every tool call, every model request, every channel message, every Scout event is logged with:
- Timestamp (microsecond precision)
- Session ID and workspace ID
- Action type and parameters
- Result or error
- Cryptographic hash of the log entry (tamper detection)

The audit log is append-only. Entries cannot be modified or deleted through the Scout API.
Operators can export via `GET /api/export` (JSON or CSV) and search via `GET /api/audit-search`.

### Compliance Export
`GET /api/compliance` generates evidence packages for:
- SOC 2 Type II (security, availability, processing integrity, confidentiality, privacy)
- ISO 27001 (information security management)
- GDPR (data processing records, subject access request evidence, data retention compliance)
- EU AI Act (Article 13 transparency, Article 9 risk management, Article 12 logging)

The export is a structured JSON document with timestamped evidence for each control, ready to
hand to an auditor.

### Prompt Injection Shield
Three-layer detection:

1. **Regex layer:** Pattern matching against known injection signatures (role-switching attempts,
   override instructions, "ignore previous instructions" variants, DAN patterns)
2. **LLM judge:** A separate, lightweight model call evaluates the incoming message for
   adversarial intent when the regex layer flags it
3. **Tool result scanning:** Agent tool results (web search output, document content, email body)
   are also scanned before being returned to the main agent context

If injection is detected, Scout blocks the message, logs the incident, and alerts the operator.

### Egress Filtering
Outgoing responses from the agent are filtered before delivery to the channel. Configurable rules
block:
- PII patterns (email addresses, phone numbers, card numbers, national insurance numbers)
- Credential patterns (API keys, passwords in plaintext)
- Custom regex patterns defined by the operator

### Honeypots
Fake credentials (API keys, database URLs, AWS access keys) are planted in the agent's accessible
context. If those credentials appear in any outgoing message or tool call, Scout triggers an
immediate breach alert. This detects data exfiltration that bypasses the egress filter because
the attacker found credentials the agent was not supposed to share.

### Deception Layer
Moving target deception: system prompt markers are randomized per session. Prompt injection attacks
that target known static markers fail because the markers change. Scout's deception module manages
the generation and rotation of these markers (`api/deception.ts`, `api/markers.ts`).

### JIT Credentials
Just-in-time credential provisioning (`api/jit-privileges.ts`): instead of giving the agent
permanent access to a resource, Scout provisions a time-limited credential scoped to the specific
operation. The credential expires automatically and is revoked in Scout's audit log.

## Blockchain Verification

Scout maintains on-chain records on the Base blockchain (Ethereum L2):

- **ERC-8004:** Agent identity standard. Scout registers Carina as agent #6981 with slug
  `carina-reference`. The registration transaction is on Base Sepolia testnet. Main net
  registration is a manual operator step.

- **ERC-8126:** Verification attestation standard. Weekly `labyrinth-scout.v1` security
  attestations are published on-chain. Third parties can verify that Carina's security posture
  has been independently assessed and that the risk score is current.

The public trust API at `carinaai.uk/trust` polls Scout's chain records and returns a JSON
payload with: `risk_score`, `identity.status`, `chain.erc8004_status`, `chain.erc8126_status`,
`verification.on_chain` (explorer links), and `data_freshness.stale` (whether the attestation
is outdated).

This means any partner or enterprise customer can programmatically verify Carina's security
posture without taking VERLOX's word for it.

## Alert Channels

Scout sends alerts through six channels simultaneously or in escalation order based on severity:

| Channel | File | Trigger |
|---|---|---|
| Discord | `discord.ts` | All severities (webhook) |
| Email | `email.ts` | Warning and above (via Resend) |
| Slack | `slack.ts` | Warning and above (webhook) |
| SMS | `sms.ts` | Critical and breach only |
| Telegram | `telegram.ts` | All severities (bot) |
| WhatsApp | `whatsapp.ts` | Critical and breach only |

Alert severity levels: `info` < `warning` < `critical` < `breach`.

The escalation policy (`escalation.ts`) defines SLA response times per severity. If an alert is
not acknowledged within the SLA window, it escalates to the next severity level.

## Scout Tiers (Pricing)

| Tier | Price | What It Provides |
|---|---|---|
| Scout Monitor | GBP 49/month | Observe: monitoring, threat detection, audit log search, 6-channel alerts, weekly report |
| Scout Govern | GBP 99/month | Act: everything in Monitor plus kill switch, compliance export, injection shield, egress filter, honeypots, deception layer, JIT credentials, forensic tools |
| Enterprise | Custom | Dedicated infrastructure, custom log retention, SLA, SOC 2 evidence package, regulatory engagement support |

"One you see. The other you act on what you see."

## Scout in the Core Backend

The core backend has a `hosted-scout.ts` module that bridges the hosted SaaS layer with Scout.
When Carina is running in hosted mode, every tenant's agent activity is reported to Scout.
The Scout console aggregates across all tenants, showing the operator a fleet view.

The core API also exposes `src/api/middleware/` for Scout-aware request handling, and
`src/channels/channel-scout-signals.ts` sends channel-level events to Scout.

## 57 Scout API Modules

The Scout console exposes a comprehensive API. Selected modules:

`account`, `admin`, `alert-channels`, `anomalies`, `attack-surface`, `audit-search`,
`auto-remediation`, `block-session`, `compliance`, `dashboard`, `deception`, `egress-control`,
`events`, `export`, `heartbeat`, `honeypots`, `incidents`, `instances`, `jit-privileges`,
`kill`, `killswitch-status`, `markers`, `memory-control`, `platform-settings`, `policy`,
`policy-evaluate`, `policy-packs`, `provision`, `public-trust`, `quarantine`, `rate-control`,
`readiness`, `response-terminal`, `resume`, and more.
