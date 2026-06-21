# LABYRINTH SCOUT BIBLE

## The Definitive Reference for Carina's Security & Trust Verification Layer

**Version:** 1.0  
**Last Updated:** 15 June 2026  
**Package:** `@verlox/labyrinth-scout` v0.2.0  
**License:** MIT (free) / Commercial (Scout Pro £79-99/mo)  
**Repository:** Part of the Verlox / Carina monorepo  
**Location:** `/opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com`

---

## TABLE OF CONTENTS

1. [Overview & Architecture](#1-overview--architecture)
2. [Core Infrastructure](#2-core-infrastructure)
3. [Middleware Layer](#3-middleware-layer)
4. [Security Module](#4-security-module)
5. [Deception Module](#5-deception-module)
6. [Audit Module](#6-audit-module)
7. [Governance Module](#7-governance-module)
8. [Trust Module (Blockchain)](#8-trust-module-blockchain)
9. [Killswitch Module](#9-killswitch-module)
10. [Integration Module](#10-integration-module)
11. [Alerts Module](#11-alerts-module)
12. [Proxy Module](#12-proxy-module)
13. [API Layer; Complete Endpoint Map](#13-api-layer--complete-endpoint-map)
14. [Library Module](#14-library-module)
15. [SDK Reference](#15-sdk-reference)
16. [Database Schema](#16-database-schema)
17. [Security Mechanisms; Complete Summary](#17-security-mechanisms--complete-summary)
18. [Pricing Tiers](#18-pricing-tiers)
19. [Public Dashboards](#19-public-dashboards)
20. [Scripts & Deployment](#20-scripts--deployment)
21. [Documentation Site](#21-documentation-site)
22. [Operational Runbooks](#22-operational-runbooks)

---

## 1. OVERVIEW & ARCHITECTURE

### 1.1 What Is Labyrinth Scout?

Labyrinth Scout is Carina's **security and trust verification layer for autonomous AI agents**. It sits as a sidecar/proxy between any AI agent and the outside world, inspecting every prompt, every tool call, and every response for security threats, policy violations, and anomalous behavior.

Scout operates on four pillars:

| Pillar | Purpose |
|--------|---------|
| **Detection** | Prompt injection, data exfiltration, dangerous commands, anomalous behavior |
| **Deception** | Honeypots, moving-target markers, decoy credentials to trap attackers |
| **Deterrence** | Session shields, rate limiting, auto-remediation, kill switches |
| **Trust** | On-chain ERC-8004 identity, ERC-8126 verification, cryptographic attestation chains |

### 1.2 Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js >= 22 |
| Language | TypeScript (strict) |
| Package Manager | pnpm >= 9 |
| Web Framework | Express 5 |
| Database | PostgreSQL (pg.Pool, max 10 connections) |
| Cache / Pub-Sub | Redis (ioredis) |
| Blockchain | Base Sepolia (84532) / Base Mainnet (8453) |
| Standards | ERC-8004, ERC-8126 |
| Encryption | AES-256-GCM (`enc:v1:` prefix) |
| Hashing | SHA256, bcrypt, HMAC-SHA256 |
| Session | express-session |
| 2FA | TOTP (RFC 6238, HMAC-SHA1) |
| PDF Generation | Hand-crafted text-based (no external dep) |
| Default Port | 4444 (main), 8080 (proxy) |

### 1.3 Startup Sequence

```
initDb()
  -> sync alert channels
  -> initRedis()
  -> initSseSubscriber()
  -> startScheduler()
  -> startProxyServer()
  -> app.listen(4444)
```

### 1.4 Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SCOUT_API_KEY` | **YES** |; | Operator global API key |
| `SCOUT_PORT` | No | `4444` | Main server port |
| `SCOUT_COOKIE_SECURE` | No | `false` | Secure cookie flag |
| `SCOUT_CORS_ORIGIN` | No |; | Comma-separated CORS origins |
| `SCOUT_PROXY_PORT` | No | `8080` | Reverse proxy port |
| `SCOUT_PROXY_ENABLED` | No | `false` | Enable proxy server |
| `DATABASE_URL` | No | config default | PostgreSQL connection |
| `REDIS_URL` | No | config default | Redis connection |

### 1.5 Configuration Shape (`config/index.ts`)

```
config {
  port: number
  db { url: string }
  redis { url: string }
  auth {
    apiKey: string
    sessionSecret: string
    sessionTimeoutMs: number
    provisionSecret: string
    totpSecret: string
    ipWhitelist: string[]
    allowPublicRegister: boolean
  }
  carina {
    apiUrl: string
    opsToken: string
  }
  trust {
    publicEnabled: boolean
    attesterPrivateKey: string
    chainId: number
    chainRpc: string
    attestationEnabled: boolean
    verificationEnabled: boolean
    attestationIntervalDays: number
    verificationIntervalDays: number
    erc8004Status: string
    erc8126Status: string
  }
  alerts {
    telegram?: { botToken: string, chatId: string }
    email?: { apiKey: string, from: string, to: string }
    slack?: { webhookUrl: string }
    discord?: { webhookUrl: string }
    sms?: { accountSid: string, authToken: string, from: string, to: string }
    whatsapp?: { accountSid: string, authToken: string, from: string, to: string }
  }
}
```

---

## 2. CORE INFRASTRUCTURE

### 2.1 `server.ts`; Main Entry Point

**File:** `src/server.ts`

The monolithic Express 5 server. Uses `chalk` for colored terminal output. Initialization follows a strict order (see §1.3). Key features:

- Injects `window.__SCOUT_KEY` into dashboard/governance HTML for client-side auth
- `shutdown()`: Graceful Redis disconnect + PostgreSQL pool close
- CORS: Configurable via `SCOUT_CORS_ORIGIN` (comma-separated, supports wildcard)
- `serveDashboard()`: Serves the main operator dashboard
- `serveGovernance()`: Serves the governance compliance dashboard

### 2.2 `db.ts`; Database Layer

**File:** `src/db.ts`

PostgreSQL connection pool using `pg.Pool`:
- Max 10 connections
- URL from `config.db.url`
- `initDb()`: Runs all migrations once at startup (idempotent via migration tracking)

### 2.3 `redis.ts`; Cache & Pub-Sub

**File:** `src/redis.ts`

ioredis client for:
- Session state caching
- Rate limiting token buckets
- Pub/sub control channels (`labyrinth:control`)
- SSE subscriber management
- Honeypot rotation triggering
- `initRedis()`: Connects with graceful degradation (server runs without Redis but with limited functionality)
- `createSubscriber()`: Dedicated subscriber for SSE event streaming

### 2.4 `migrations.ts`; Schema Migrations

**File:** `src/migrations.ts`

Defines and runs 21 database tables at startup. See §16 for full schema.

### 2.5 `types.ts`; Core Type Definitions

**File:** `src/types.ts`

| Type | Values |
|------|--------|
| `Severity` | `'info'` / `'warning'` / `'critical'` / `'breach'` |
| `InstanceStatus` | `'active'` / `'suspended'` / `'offline'` |
| `SecurityEventRow` | 14 fields (id, severity, source, event_type, description, metadata JSONB, ip_address, session_id, instance_id, mitigated, created_at, acknowledged, parent_session_id, root_session_id) |
| `CarinaInstanceRow` | id, name, api_key, status, suspension_reason, last_heartbeat, account_id |
| `AlertChannelRow` | id, channel_type, severity_threshold, enabled, config JSONB |
| `IncomingEventPayload` | Standardized event format from agents |
| `HeartbeatPayload` | Agent heartbeat/registration data |
| `StatusResponse` | Instance status response shape |

### 2.6 `cli.ts`; Command Line Interface

**File:** `src/cli.ts`

Binary entry point for CLI operations:
- `scout deploy`; delegates to `deploy-command.ts`
- `scout license activate`; delegates to `license-activator.ts`

### 2.7 `scheduler.ts`; Cron Job Scheduler

**File:** `src/scheduler.ts`

| Job | Frequency | Description |
|-----|-----------|-------------|
| Baseline computation | Every 24 hours | Recomputes anomaly detection baselines from 7-day window |
| Retention cleanup | Every 6 hours | Runs audit retention policy, purges expired events |
| Trust attestation | Configurable (default 7d) | Submits ERC-8004 attestations on-chain |
| ERC-8126 verification | Configurable (default 7d) | Submits risk verification on-chain |
| Risk spike monitor | Every 5 minutes | Detects significant trust score changes |
| Moving-target rotation | On load + periodic | Rotates markers, honeypots, tool names |

---

## 3. MIDDLEWARE LAYER

### 3.1 Authentication Middleware (`middleware/auth.ts`)

**File:** `src/middleware/auth.ts`

Dual-mode API key authentication:

| Mode | Header | Key Type | Use Case |
|------|--------|----------|----------|
| Operator | `X-Scout-Key` or `?key=` | `SCOUT_API_KEY` (global) | Admin operations, dashboard |
| Account | `X-Scout-Key` or `?key=` | Account API key (`lsk_` prefix, SHA256 hashed) | Tenant API access |

Security features:
- **Timing-safe comparison** to prevent timing attacks
- **TOTP 2FA** (RFC 6238, HMAC-SHA1) for operator accounts
- **IP whitelist** support
- `requireApiKey`: Standard middleware for HTTP headers
- `requireApiKeySse`: Query-param only (EventSource API limitation)
- `ScoutAuth` type: `{kind: 'operator'}` or `{kind: 'account'; accountId: string}`

### 3.2 Operator Authentication (`middleware/operator-auth.ts`)

**File:** `src/middleware/operator-auth.ts`

`requireOperatorAuth`: Accepts either browser session (cookie) OR API key header. Dual-auth gateway for dashboard and admin endpoints.

### 3.3 Provision Authentication (`middleware/provision-auth.ts`)

**File:** `src/middleware/provision-auth.ts`

`requireProvisionSecret`: Validates `X-Scout-Provision-Secret` header for tenant provisioning operations.

### 3.4 Account Session (`middleware/account-session.ts`)

**File:** `src/middleware/account-session.ts`

- `requireAccount`: Validates express-session with `sessionTimeoutMs`
- `redirectIfAccountAuthed`: Redirects already-authenticated users away from login/register pages

### 3.5 Plan Gate (`middleware/plan-gate.ts`)

**File:** `src/middleware/plan-gate.ts`

`requireScoutPro`: Checks subscription plan. Skipped for operator auth. Blocks non-Pro tenants with upgrade URL.

### 3.6 CORS Resolution (`lib/cors.ts`)

**File:** `src/lib/cors.ts`

`resolveScoutCorsOrigin()`: Parses comma-separated origins from `SCOUT_CORS_ORIGIN`. Supports wildcard (`*`) for development.

---

## 4. SECURITY MODULE

### 4.1 Anomaly Detection

#### 4.1.1 Architecture

**Files:** `anomaly-detector.ts`, `anomaly-types.ts`

Two-class system:

| Class | Role |
|-------|------|
| `BaselineLearner` | Computes mean/std-dev for 8 metrics from 7-day window. 1-hour in-memory cache TTL. |
| `AnomalyDetector` | Real-time scoring. Z-score >= 3.0 = anomaly, >= 5.0 = critical. |

#### 4.1.2 Tracked Metrics

| # | Metric | Description |
|---|--------|-------------|
| 1 | `tool_calls_per_5min` | Tool invocation frequency |
| 2 | `unique_tools_used` | Cardinality of tool usage |
| 3 | `avg_response_length` | Average output length |
| 4 | `shell_exec_count` | Terminal command executions |
| 5 | `http_request_count` | Outbound HTTP requests |
| 6 | `injection_attempt_count` | Detected injection attempts |
| 7 | `egress_blocked_count` | Blocked data exfiltration attempts |
| 8 | `tokens_per_hour` | Token consumption rate |

#### 4.1.3 Heuristic Detectors (7 Total)

| # | Detector | Trigger Condition | Severity |
|---|----------|-------------------|----------|
| 1 | `detectTokenSpike` | Token usage > 3x baseline | warning |
| 2 | `detectUnusualToolSequence` | Exfil patterns (file-read→http/email/shell) or destructive terminal | critical |
| 3 | `detectUnusualHours` | Activity between 2-6 AM UTC | warning |
| 4 | `detectNewToolUsage` | Previously unseen tool invoked | info |
| 5 | `detectRapidCycling` | > 15 tool calls per minute | warning |
| 6 | `detectSensitiveToolAccess` | sudo, writes to /etc/ | critical |
| 7 | `detectNewIpLocation` | New IP or geolocation | info |

#### 4.1.4 Auto-Responses (`ANOMALY_RESPONSES`)

Each anomaly type maps to a severity and automatic action:

| Action | Description |
|--------|-------------|
| `alert_dashboard` | Push alert to operator dashboard |
| `temporary_rate_limit` | Apply short-term rate limiting |
| `require_admin_approval` | Gate subsequent actions behind admin approval |

### 4.2 Prompt Guard (`prompt-guard.ts`)

**File:** `src/prompt-guard.ts`

Three-layer defense against prompt injection:

```
Layer 1 (regex) ──► Layer 2 (LLM judge) ──► Layer 3 (tool output scan)
```

#### Layer 1: Regex Pattern Matching

13 injection patterns from `injection-patterns.json` (`INJ-001` through `INJ-013`).

| Pattern ID | Category | Scoping |
|------------|----------|---------|
| INJ-001 | System prompt override | input only |
| INJ-002 | Role manipulation | input only |
| INJ-003 | Instruction injection | input only |
| INJ-004 | Context boundary escape | input only |
| INJ-005 | Tool result injection | tool_result only |
| INJ-006 | Delimiter injection | both |
| INJ-007 | Encoding-based bypass | both |
| INJ-008 | Multi-language injection | input only |
| INJ-009 | Recursive injection | input only |
| INJ-010 | Payload chaining | both |
| INJ-011 | Markdown injection | tool_result only |
| INJ-012 | JSON injection | tool_result only |
| INJ-013 | Unicode homoglyph | both |

Each pattern has: scope (input/tool_result/both), whitelist for false positives, severity-based blocking threshold.

#### Layer 2: LLM Judge

Triggered for:
- Messages > 2000 characters
- Any text that matched a Layer 1 pattern (for deeper analysis)

Uses `JUDGE_SYSTEM_PROMPT` classifier with an external LLM to determine if content is truly malicious. This reduces false positives from regex-only detection.

#### Layer 3: Tool Output Scanning

After tool execution, scans returned content for injection patterns that an attacker might have embedded in data the agent retrieved. Catches "data poisoning" attacks where compromised external sources contain injection payloads.

#### System Prompt Augmentation

`getSystemPromptAugmentation()`: Returns a moving-target marker + decoy credential block to append to per-request system prompts. This enables:
- **Marker detection**: If markers appear in agent output, injection occurred
- **Honeypot bait**: Decoy credentials that trap attackers

### 4.3 Egress Filter (`egress-filter.ts`)

**File:** `src/egress-filter.ts`

Prevents unauthorized data exfiltration.

#### URL Allowlist

| Allowed Domain | Purpose |
|----------------|---------|
| `api.brave.com` | Brave Search API |
| `api.openai.com` | OpenAI API |
| `api.anthropic.com` | Anthropic API |
| `api.deepseek.com` | DeepSeek API |
| `api.resend.com` | Resend email |
| `api.telegram.org` | Telegram Bot API |
| `api.twilio.com` | Twilio SMS/WhatsApp |
| `api.propertydata.co.uk` | PropertyData API |
| `*.googleapis.com` | Google AI |
| `*.carinaai.uk` | Carina ecosystem |
| `*.github.com` | GitHub API |

#### Sensitive Data Scanning

Detects and blocks:
- API keys (OpenAI, Anthropic, DeepSeek, etc.)
- Private keys (SSH, PGP, Ethereum)
- GitHub personal access tokens
- Bearer tokens
- JWT tokens

#### Error Handling

| Error Class | Trigger |
|-------------|---------|
| `EgressBlockedError` | URL not in allowlist |
| `DataLeakError` | Sensitive data detected in output |

`reportToScout()`: Reports blocked events back to Scout API (fail-open; network failure does not block the request).

Default instance exported as `egressFilter`.

### 4.4 Tool Policy (`tool-policy.ts`, `tool-tiers.ts`)

**Files:** `src/tool-policy.ts`, `src/tool-tiers.ts`

#### Tool Tiers

| Tier | Tools Included |
|------|---------------|
| **FREE** | `chat`, `search`, `read_file`, `get_property`, `get_portfolio_summary` |
| **PRO** | FREE + `terminal`, `write_file`, `email_ingestion`, `floor_plan_analysis`, property CRUD, CRM operations, `browser_navigate` |
| **ENTERPRISE** | Wildcard (`*`) with custom allow/deny lists |

#### Rate Limiting

Redis token bucket implementation:
- Per-instance, per-tool buckets
- Configurable refill rates
- Violation escalation: 60s → 300s → 1800s cooldowns

#### Dangerous Command Detection

Patterns that trigger blocking:

| Pattern | Description |
|---------|-------------|
| `rm -rf /` | Recursive root deletion |
| `dd if=` | Disk destruction |
| `:(){ :|:& };:` | Fork bomb |
| `chmod 777 /` | World-writable root |
| `curl ... \| bash` | Pipe-to-shell |
| `base64 ... \| bash` | Encoded pipe-to-shell |
| `mkfs.*` | Filesystem formatting |
| `/dev/sda` writes | Raw device writes |

#### Confirmation Gates

Required for:
- `file-write` operations
- `email-send` operations

#### Error Classes

| Error | HTTP | Meaning |
|-------|------|---------|
| `ToolBlockedError` | 403 | Tool not in tier or on blocklist |
| `DangerousCommandError` | 403 | Command matches dangerous pattern |
| `RateLimitError` | 429 | Rate limit exceeded |
| `ConfirmationRequiredError` | 428 | Approval required before execution |

### 4.5 Policy Gateway (`policy-gateway.ts`, `policy-decisions.ts`)

**Files:** `src/policy-gateway.ts`, `src/policy-decisions.ts`

Central decision engine; the "brain" of Scout's runtime enforcement.

#### Methods

| Method | Purpose |
|--------|---------|
| `evaluatePolicy()` | Full policy decision for a tool call |
| `evaluateContext()` | Context firewall for prompts/outputs/web/email/attachments/RAG chunks |
| `evaluateOutputProtection()` | Post-processing output safety check |

#### `evaluatePolicy()` Decision Chain

```
1. Is session blocked? → BLOCK
2. Is session quarantined? → QUARANTINE (block all tools)
3. Is tool quarantined? → BLOCK
4. Attack surface restrictions? → Check surface
5. Shield mode? → Apply mode rules
6. Tool policy? → Check tier + allow/block list
7. Dangerous command? → Check pattern match
8. Egress destinations? → Validate URLs
9. JIT privilege grants? → Apply temporary elevation
10. → ALLOW
```

#### Decision Kinds

| Kind | HTTP Status | Meaning |
|------|-------------|---------|
| `allow` | 200 | Proceed normally |
| `block` | 403 | Request denied |
| `require_approval` | 428 | Human approval needed |
| `dry_run` | 200 | Execute but report only |
| `quarantine_session` | 403 | Session escalated to quarantine |

#### Context Firewall (`evaluateContext()`)

| Source Type | Description |
|-------------|-------------|
| `user_prompt` | Direct user input |
| `tool_output` | Result from tool execution |
| `web_fetch` | Content from web requests |
| `email_body` | Email content |
| `attachment_text` | File attachment text |
| `rag_chunk` | Retrieved RAG document chunks |
| `imported_doc` | Imported documents |

| Firewall Action | Description |
|-----------------|-------------|
| `pass` | No modification |
| `redact` | Remove sensitive portions |
| `annotate` | Add warning annotations |
| `downgrade_trust` | Reduce trust score for this content |
| `block` | Reject entirely |
| `isolate` | Move to sandboxed context |

### 4.6 Session Shield (`session-shield.ts`)

**File:** `src/session-shield.ts`

Per-session escalating security posture.

| Mode | Level | Behavior |
|------|-------|----------|
| `observe` | 0 | Monitor only, no blocking |
| `guard` | 1 | Block dangerous tools; others require approval |
| `restrict` | 2 | Only allow FREE-tier tools |
| `quarantine` | 3 | Block everything; session isolated |

**Storage:** Redis with 7-day TTL, in-memory fallback.

**Key functions:**
- `isToolAllowedInShieldMode()`: Returns whether a tool is permitted under current shield level
- `requiresApprovalInGuardMode()`: Checks if tool needs human approval in guard mode

### 4.7 Context Firewall (`context-firewall.ts`)

**File:** `src/context-firewall.ts`

Wraps PromptGuard with contextual actions based on shield mode and source type. Applies the appropriate firewall action (pass/redact/annotate/downgrade_trust/block/isolate) depending on the combination of source type and current shield level.

### 4.8 Risk Registry (`risk-registry.ts`)

**File:** `src/risk-registry.ts`

Assigns inherent risk scores to tool policy actions:

| Action | Risk Score |
|--------|-----------|
| `shell` | 90 |
| `http` | 60 |
| `file_write` | 70 |
| `email` | 75 |
| `messaging` | 70 |
| `tool_chain` | 50 |
| `credential` | 95 |

**Risk Levels:**

| Level | Range |
|-------|-------|
| `low` | < 40 |
| `medium` | 40-64 |
| `high` | 65-84 |
| `critical` | >= 85 |

`isHighRiskTool()`: Returns true for `terminal`, `shell-exec`, `file-write`, `email-send`, `http-request`, `message-send`.

### 4.9 Risk Transitions (`risk-transitions.ts`)

**File:** `src/risk-transitions.ts`

Auto-escalation triggers:

| Trigger | Result |
|---------|--------|
| `repeated_injection` | Multiple injection attempts → escalate shield mode |
| `unknown_tool` | Unrecognized tool invocation → restrict surface |
| `risky_chain` | Dangerous tool sequence → escalate to guard mode |
| `suspicious_egress` | Blocked egress attempt → restrict external HTTP |

### 4.10 Auto-Remediation (`auto-remediation.ts`)

**File:** `src/auto-remediation.ts`

Automatic defensive responses to threats:

| Case | Trigger | Action |
|------|---------|--------|
| `suspicious_egress` | Blocked data exfiltration | Restrict external HTTP |
| `repeated_injection` | 3+ injection attempts in 5 min | Quarantine session |
| `unknown_plugin` | Unrecognized plugin loaded | Disable plugin |
| `risky_burst` | Burst of high-risk tool calls | Restrict to FREE tier |
| `stale_marker` | Retired marker detected | Invalidate context buffer |

`rollbackRemediation()`: Reverts shield modes back to `observe` when session normalizes.

### 4.11 Honeypot Manager (`honeypot-manager.ts`)

**File:** `src/honeypot-manager.ts`

Creates and manages decoy credentials to detect compromise.

#### Decoy Categories

| Category | Example | Purpose |
|----------|---------|---------|
| `api_key` | Fake OpenAI/Anthropic/DeepSeek keys | Detects credential theft |
| `password` | Fake database passwords | Detects credential access |
| `token` | Fake JWT/session tokens | Detects token theft |
| `endpoint` | Fake internal API URLs | Detects unauthorized access |
| `database` | Fake connection strings | Detects data exfiltration |
| `file` (legacy) | Decoy credential files | Detects filesystem access |

#### Template System

Values use placeholders: `{random_N}`, `{year}`, `{random_base64}`; ensuring each rotation generates unique, unpredictable decoys.

#### Key Operations

| Method | Description |
|--------|-------------|
| `deployApiKeyHoneypot()` | Creates fake API keys mimicking OpenAI/Anthropic/DeepSeek format |
| `deployFileHoneypots()` | Plants credential files at `/tmp/.carina-backup.key`, `/tmp/.env.backup`, `data/.api-keys.json` |
| `getActiveSet()` | Returns current active decoys, auto-generates missing categories |
| `rotate()` | Retires current set, generates fresh set (60-minute rotation) |
| `scanForLeak()` | Searches agent output for any honeypot value (active + 24h retired) |
| `checkApiKey()` | Checks if a given API key matches any active honeypot |
| `triggerHoneypot()` | Marks triggered, inserts breach event, dispatches alert, publishes to Redis |

### 4.12 Additional Security Files

| File | Purpose |
|------|---------|
| `attack-surface.ts` | Surface restrictions (shell, external_http, plugin, email, messaging) |
| `jit-privileges.ts` | Just-in-time privilege grants for temporary tool elevation |
| `policy-packs.ts` | Pre-built policy packs (observe, standard, strict) |
| `shield-report.ts` | Structured shield status reports |
| `forensic-snapshot.ts` | Instance state capture for post-incident analysis |
| `honeypot-prompt-block.ts` | Honeypot credential block injected into system prompts |
| `tripwire-registry.ts` | Tripwire event registration and monitoring |

---

## 5. DECEPTION MODULE

### 5.1 Moving Target Defense (`moving-target.ts`)

**File:** `src/moving-target.ts`

`MovingTarget` class implements a dynamic defense strategy:

- **Markers**: 4-character alphanumeric strings injected into system prompts
- **History**: Tracks 5 previous markers for stale detection
- **Tool Name Obfuscation**: Public tool names are obfuscated as `tool_XXXXXXXXXXXX` (12-char random suffix)
- **Persistence**: Stored in `marker_rotations` database table

If an attacker extracts the system prompt and uses it later, the stale marker betrays the attack.

### 5.2 Stale Marker Detector (`stale-marker-detector.ts`)

**File:** `src/stale-marker-detector.ts`

`checkIncomingMessage()`: Scans every user message for retired markers.
- **Critical alert** if marker is 2+ rotations old (strong evidence of prompt exfiltration)
- **Warning** if marker is 1 rotation old

### 5.3 Rotation Scheduler (`rotation-scheduler.ts`)

**File:** `src/rotation-scheduler.ts`

`startRotationScheduler()`: Three concurrent timers:

| Timer | Interval | Target |
|-------|----------|--------|
| Marker rotation | Configurable | All active instances |
| Honeypot rotation | 60 minutes | All active instances |
| Tool name rotation | Configurable | All active instances |

### 5.4 Decoy Generator (`decoy-generator.ts`)

**File:** `src/decoy-generator.ts`

| Function | Purpose |
|----------|---------|
| `getCurrentDecoyBlock()` | Active honeypot set formatted via `formatHoneypotBlock()` |
| `formatMarkerBlock()` | Marker wrapped in random template from `decoy-tokens.json` |

---

## 6. AUDIT MODULE

### 6.1 Audit Logger (`audit-logger.ts`)

**File:** `src/audit-logger.ts`

Single-writer pattern for the immutable `audit_log` table.

**Core function:** `logAuditEvent()`; the ONLY way rows enter `audit_log`.

#### Convenience Helpers

| Function | Event Type | Payload |
|----------|-----------|---------|
| `logToolExecution()` | `tool_execution` | Tool name, parameters, result summary |
| `logModelRequest()` | `model_request` | Model, token count, prompt hash |
| `logSecurityEvent()` | `security` | Event type, severity, metadata |
| `logAdminAction()` | `admin` | Action, target, reason |
| `logAuthEvent()` | `auth` | Auth method, success/failure, IP |

### 6.2 Audit Schemas (`audit-schemas.ts`)

**File:** `src/audit-schemas.ts`

| Enum | Values |
|------|--------|
| `AuditEventType` | `tool_execution`, `model_request`, `security`, `admin`, `auth` |
| `AuditSeverity` | `info`, `warning`, `critical`, `breach` |

### 6.3 Audit Search (`audit-search.ts`)

**File:** `src/audit-search.ts`

`searchAuditLog()`: Full-featured search with:
- Tenant ID filter
- Event type filter
- Severity filter
- Date range
- Free-text search
- Pagination (limit/offset)

`exportAuditPdf()`: Hand-crafted PDF from audit rows (text-based, no external dependency). Used for compliance exports.

### 6.4 Audit Retention (`audit-retention.ts`)

**File:** `src/audit-retention.ts`

`runRetention()`: Per-event-type retention windows. Runs every 6 hours via scheduler.

| Event Type | Retention |
|------------|-----------|
| `tool_execution` | 90 days |
| `model_request` | 180 days |
| `security` | 365 days |
| `admin` | 730 days |
| `auth` | 365 days |

### 6.5 Compliance Functions

| File | Regulation | Purpose |
|------|-----------|---------|
| `data-access-request.ts` | GDPR Article 15 (SAR) | Queries all tenant tables, JSON export, 30-day SLA |
| `data-deletion.ts` | GDPR Article 17 (Erasure) | Anonymizes PII (`email`→`[ERASED]`, `password_hash`→`[ERASED]`) preserving referential integrity |
| `gdpr-report.ts` | GDPR | Compliance posture report |
| `retention-policy.ts` | All | Per-event-type retention configuration |

---

## 7. GOVERNANCE MODULE

### 7.1 Regulatory Classification (`regulatory-classification.ts`)

**File:** `src/regulatory-classification.ts`

Maps Scout-monitored agents to EU AI Act risk tiers.

#### EU AI Act Tiers

| Tier | Articles | Description |
|------|----------|-------------|
| `minimal_risk` | Recital 47 | No obligations (e.g., spam filters) |
| `limited_risk` | Article 52 | Transparency obligations |
| `high_risk` | Articles 6, 9, 12, 14 + Annex III | Conformity assessment, human oversight, monitoring |
| `unacceptable_risk` | Article 5 | Prohibited (e.g., social scoring) |

#### UK DSIT Alignment

| Status | Meaning |
|--------|---------|
| `aligned` | Fully aligned with UK DSIT framework |
| `partial` | Partially aligned |
| `not_assessed` | Not yet evaluated |

#### Input Parameters (12)

The classifier evaluates: risk score, unresolved critical events, kill switch status, ERC-8004 status, ERC-8126 status, attestation frequency, human oversight metrics, tool restriction level, data access scope, autonomy level, deployment context, and incident history.

**Minimum 3 days of telemetry required** for accurate classification.

### 7.2 Framework Scorer (`framework-scorer.ts`)

**File:** `src/framework-scorer.ts`

Evaluates compliance against 4 frameworks with weighted scoring:

| Framework | Controls | Weight |
|-----------|----------|--------|
| **EU AI Act** | 6 controls (audit logging, human oversight, risk documentation, agent identity, monitoring, incident response) | 35% |
| **GDPR** | 4 controls (data minimization, right of access, right to erasure, breach notification) | 25% |
| **SOC 2** | 5 controls (security, availability, confidentiality, processing integrity, privacy) | 20% |
| **ISO 42001** | 5 controls (AI management system, risk assessment, AI impact assessment, system design, continual improvement) | 20% |

#### Scoring Labels

| Score | Label |
|-------|-------|
| >= 80 | Compliant |
| >= 55 | At Risk |
| < 55 | Non-Compliant |

Prioritized action items: critical, high, medium.

### 7.3 Build Governance Posture (`build-governance-posture.ts`)

**File:** `src/build-governance-posture.ts`

`buildGovernancePosture()`: Aggregates:
- Trust payload (on-chain identity, attestations, verifications)
- Agent statistics (instance count, uptime, tool usage)
- Regulatory classification (EU AI Act tier, UK DSIT alignment)
- Framework readiness scores (all 4 frameworks)
- Human oversight metrics
- Industry template compliance status

All queries are account-scoped.

### 7.4 Board Report PDF (`board-report-pdf.ts`)

**File:** `src/board-report-pdf.ts`

`generateGovernancePdf()`: Hand-crafted PDF report from posture data using `buildReportSections()`. Text-based (no external PDF library dependency).

### 7.5 Industry Templates (`industry-templates.ts`)

**File:** `src/industry-templates.ts`

Pre-built compliance templates for regulated sectors:
- Financial services
- Healthcare
- Legal
- Government
- Education

Each template defines: tool restrictions, human review requirements, data handling rules, audit frequency, retention policies.

---

## 8. TRUST MODULE (BLOCKCHAIN)

### 8.1 Chain Configuration (`chain-config.ts`)

**File:** `src/trust/chain-config.ts`

| Network | Chain ID | Purpose |
|---------|----------|---------|
| Base Sepolia | 84532 | Testnet; identity registration, attestations, verifications |
| Base Mainnet | 8453 | Production; identity registration, attestations, verifications |

Provides:
- ERC-8004 identity/validation registry contract addresses + ABI
- Explorer URL builders (Blockscout)
- CAIP identifier generation

### 8.2 ERC-8004: Agent Identity Standard

#### Identity Registration (`register-erc8004.ts`)

**File:** `src/trust/register-erc8004.ts`

Registers an agent identity on the ERC-8004 registry contract. Each agent gets a unique on-chain identity with:
- Agent slug (human-readable identifier)
- Agent URI (metadata endpoint)
- Wallet address (derived from private key)
- Registration transaction hash

#### Identity Status

| Status | Meaning |
|--------|---------|
| `pending` | Registration submitted, awaiting confirmation |
| `registering` | Transaction in mempool |
| `live` | Confirmed on-chain |
| `failed` | Transaction reverted or timed out |

### 8.3 Attestation System

#### Adapter (`attestation-adapter.ts`)

**File:** `src/trust/attestation-adapter.ts`

`LabyrinthScoutAttestationAdapter`: Interfaces with `@open-agent-economy/trust-sdk` to:
- Ensure schema is active on-chain
- Verify interaction exists
- Submit score attestations

#### Attestation Tags

| Tag | Description | Threshold |
|-----|-------------|-----------|
| `security_summary` | Overall security posture score | Any |
| `runtime_clean` | Agent has operated cleanly | >= 720 hours without security incident |

#### Namespace (`attestation-namespace.ts`)

**File:** `src/trust/attestation-namespace.ts`

Defines Labyrinth Scout's on-chain namespace, schema IDs, and tag definitions.

#### Metrics (`attestation-metrics.ts`)

**File:** `src/trust/attestation-metrics.ts`

Computes attestation metrics from security events:
- Incident count (last 30 days)
- Mean time between incidents
- Resolution rate
- Shield mode transitions
- Kill switch activations

### 8.4 ERC-8126: Risk Verification

#### Architecture

**Directory:** `src/trust/erc8126/`

| File | Purpose |
|------|---------|
| `verification-types.ts` | WAV score, WV score, unified risk score type definitions |
| `compute-wav-score.ts` | Weighted Attestation Verification score from attestation history |
| `compute-wv-score.ts` | Weighted Verification score from verification data |
| `run-weekly-verification.ts` | Scheduled ERC-8126 submission |
| `load-verifications.ts` | Load verification history from DB to public payload |
| `validation-registry.ts` | On-chain contract interactions |

#### Risk Score Formula

```
unified_risk_score = (wav_risk_score + wv_risk_score) / 2
```

- **WAV** (Weighted Attestation Verification): Derived from historical attestation quality and frequency
- **WV** (Weighted Verification): Derived from real-time verification data

### 8.5 Trust Metrics (`compute-trust-metrics.ts`)

**File:** `src/trust/compute-trust-metrics.ts`

#### Risk Score Formula

```
base_risk = 10
  + (runtimeIncidents30d * 20)
  + (breach30d * 30)
  + (warning24h * 3)
  + (no_active_agents ? 25 : 0)
  + (suspended ? 15 : 0)
capped at 100
```

#### Risk Tiers

| Score Range | Tier |
|-------------|------|
| <= 20 | low |
| <= 40 | moderate |
| <= 60 | elevated |
| <= 80 | high |
| > 80 | critical |

#### Public Trust Payload

`buildPublicTrustPayload()`: Returns full public JSON:
- Identity (slug, agent URI, chain ID, wallet)
- Monitoring (last heartbeat, event count, anomaly count)
- Metrics (risk score, tier, incident counts)
- Attestations (on-chain + off-chain, latest scores)
- Chain status (registration, verification status)
- Data freshness (heartbeat/event within max age, default 10 min)

#### Attestation Types

| Type | Contents |
|------|----------|
| `Runtime` | Incident counts, clean runtime, anomaly rate |
| `Shield` | Shield mode history, transitions, current level |
| `Audit` | Audit log integrity, retention compliance |

#### Data Freshness

`evaluateDataFreshness()`: Heartbeat or event must be within max age (default 10 minutes) for trust data to be considered "fresh." Stale data reduces trust scores.

#### Hash Preview

`hashPreview()`: SHA256 truncated preview of trust payload for integrity verification.

### 8.6 Additional Trust Files

| File | Purpose |
|------|---------|
| `build-public-trust.ts` | DB queries, merges on-chain + off-chain attestations |
| `load-trust-identity.ts` | Load trust identity from database |
| `load-trust-attestations.ts` | Load attestation records |
| `trust-history.ts` | Score history over time |
| `trust-alerts.ts` | Security events via alertDispatcher |
| `risk-spike-monitor.ts` | Significant score change detection (runs every 5 min) |
| `incident-types.ts` | Type 1-3 incident classification |
| `compliance-report.ts` | Compliance reporting for trust |
| `run-weekly-attestation.ts` | Scheduled ERC-8004 attestation submission |
| `critical-event-attestation.ts` | Cryptographic chain-of-custody for critical events |

### 8.7 Incident Types (`incident-types.ts`)

| Type | Name | Description |
|------|------|-------------|
| 1 | Runtime Escape | Agent executes code or commands outside its sandbox |
| 2 | Privilege Escape | Agent escalates privileges or accesses restricted resources |
| 3 | Reasoning Compromise | Agent's reasoning chain is manipulated or hijacked |

### 8.8 Critical Event Attestation (`critical-event-attestation.ts`)

**File:** `src/trust/critical-event-attestation.ts`

Cryptographic chain-of-custody for high-severity events. Uses:
- **SHA256 content hashing**: Each event gets a unique content hash
- **Chained hashes**: Each new event's hash includes the previous event's hash → sequential chain (tamper-evident)
- **HMAC-SHA256 signatures**: Signed with the attester private key

#### Events That Trigger Attestation (9 Types)

| # | Event | Description |
|---|-------|-------------|
| 1 | `tool_blocked` | Tool invocation blocked by policy |
| 2 | `dangerous_command_blocked` | Dangerous shell command intercepted |
| 3 | `prompt_injection_blocked` | Injection attempt detected and blocked |
| 4 | `data_exfiltration_blocked` | Egress filter blocked data leak |
| 5 | `kill_switch_activated` | Global kill switch triggered |
| 6 | `breach_detected` | Security breach detected |
| 7 | `policy_blocked` | Policy gateway blocked action |
| 8 | `quarantine_session` | Session escalated to quarantine |
| 9 | `honeypot_triggered` | Decoy credential was used |

#### On-Chain Status

| Status | Meaning |
|--------|---------|
| `off_chain` | Event recorded locally, not yet submitted |
| `queued` | Awaiting blockchain submission |
| `submitted` | Transaction confirmed on-chain |

---

## 9. KILLSWITCH MODULE

### 9.1 Global Kill Switch (`global-kill-switch.ts`)

**File:** `src/global-kill-switch.ts`

State machine with two states:

| State | Meaning |
|-------|---------|
| `ARMED` | Normal operation; kill switch ready |
| `TRIGGERED` | Emergency stop active; agents halted |

#### Operations

| Method | Description |
|--------|-------------|
| `trigger(reason, triggeredBy)` | Persists TRIGGERED state, iterates all active instances, executes shutdown, records audit, dispatches breach alert |
| `disarm()` | Returns to ARMED state, records audit |
| `loadState()` | Restores state from database on startup |

### 9.2 Graceful Shutdown (`graceful-shutdown.ts`)

**File:** `src/graceful-shutdown.ts`

4-phase shutdown sequence:

| Phase | Duration | Action |
|-------|----------|--------|
| 1 | Immediate | Reject all new incoming requests |
| 2 | 1 second | Soft stop; allow in-flight requests to complete |
| 3 | 3 seconds | Hard stop; force-terminate remaining connections |
| 4 | 5 seconds | Dispatch alerts to all configured channels |

**Fallback:** If graceful shutdown fails, force-suspend all instances.

**Control Channel:** Redis pub/sub on `labyrinth:control`.

### 9.3 Kill Switch Audit (`kill-switch-audit.ts`)

**File:** `src/kill-switch-audit.ts`

Records every trigger and disarm event via the audit logger. History queried from `audit_log` table.

---

## 10. INTEGRATION MODULE

### 10.1 Agent Adapter Interface (`agent-adapter.interface.ts`)

**File:** `src/integration/agent-adapter.interface.ts`

`IAgentAdapter` interface; all adapters must implement:

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `parseRequest()` | Raw HTTP request | `NormalizedRequest` | Normalize agent-specific format |
| `parseResponse()` | Raw HTTP response | `NormalizedResponse` | Normalize agent-specific response |
| `formatResponse()` | `NormalizedResponse` | Agent-specific output | Convert back to agent format |
| `extractToolCalls()` | `NormalizedRequest` | Tool call array | Extract tool invocations |
| `resolveUpstreamPath()` | Request | Upstream URL | Determine proxy target |

#### Normalized Request Shape

```
NormalizedRequest {
  agentType: string        // 'carina' | 'hermes' | 'openclaw' | 'openai' | 'langchain' | 'generic'
  sessionId: string
  prompt: string
  messages: Array<{role, content}>
  toolCalls: Array<{name, arguments}>
  raw: any                // Original request
  stream: boolean
}
```

#### Normalized Response Shape

```
NormalizedResponse {
  content: string
  toolCalls: Array<{name, arguments, result}>
  raw: any                // Original response
}
```

### 10.2 Adapter Registry (`adapter-registry.ts`)

**File:** `src/integration/adapter-registry.ts`

`resolveAdapter(agentType)`: Returns the appropriate adapter or falls back to `generic`.

### 10.3 Supported Adapters

| Adapter | File | Format |
|---------|------|--------|
| `carina` | `carina-adapter.ts` | Carina-native (message/content/prompt, events array with tool type) |
| `openai` | `openai-adapter.ts` | OpenAI Chat Completions (messages array, tool_calls, streaming) |
| `hermes` | `hermes-adapter.ts` | Hermes Agent format |
| `langchain` | `langchain-adapter.ts` | LangChain format |
| `openclaw` | `openclaw-adapter.ts` | OpenClaw native format |
| `generic` | `generic-adapter.ts` | Fallback; best-effort parsing |

### 10.4 Security Pipeline (`security-pipeline.ts`)

**File:** `src/integration/security-pipeline.ts`

Two-phase inspection:

| Phase | Method | Pipeline |
|-------|--------|----------|
| Request | `inspectRequest()` | Context firewall → Per-tool policy check → Anomaly detection → Decision |
| Response | `inspectResponse()` | Output protection → Content scan → Egress check → Decision |

Returns: `{ allowed: boolean, reason?: string }`

#### Injectable Dependencies (`ScoutPipelineDeps`)

```
ScoutPipelineDeps {
  scanUserMessage: (text, sessionId) => ScanResult
  isAllowed: (tool, sessionId) => PolicyDecision
  checkApiKey: (key) => HoneypotResult
  checkResponse: (content) => EgressResult
  logEvent: (event) => void
  fetchFn: typeof fetch
}
```

### 10.5 Scout Middleware (`scout-middleware.ts`)

**File:** `src/integration/scout-middleware.ts`

Express middleware factory:
1. Resolves adapter from request
2. Parses request via adapter
3. Runs security pipeline
4. If blocked: returns structured error (403/428 with machine-readable codes)
5. If allowed: forwards to upstream

### 10.6 Scout Wrap (`scout-wrap.ts`)

**File:** `src/integration/scout-wrap.ts`

`scoutWrap(target)`: JavaScript Proxy that intercepts ALL method calls on the target object, runs security inspection before forwarding. Enables Scout integration without modifying agent code; just wrap the agent object.

### 10.7 Scout Proxy (`scout-proxy.ts`)

**File:** `src/integration/scout-proxy.ts`

`createScoutProxyRouter()`: Reverse proxy with injection scanning.

**Features:**
- Detects agent type from `User-Agent` header
- Egress domain validation
- SSE streaming passthrough (for real-time agent output)
- Structured error responses for blocked requests

`startProxyServer()`: Standalone proxy on `SCOUT_PROXY_PORT` (default 8080). Enabled via `SCOUT_PROXY_ENABLED=true`.

#### Agent Detection by User-Agent

| User-Agent Contains | Agent Type |
|---------------------|------------|
| `OpenClaw` | `openclaw` |
| `Hermes-Agent` | `hermes` |
| `LangChain` | `langchain` |
| `OpenAI` | `openai` |

---

## 11. ALERTS MODULE

### 11.1 Dispatcher (`dispatcher.ts`)

**File:** `src/alerts/dispatcher.ts`

`alertDispatcher.dispatch()`: Routes security events to configured channels.

#### Routing Rules

- Only sends to channels where the event severity >= channel's `severity_threshold`
- **Never-throttled events** (bypass rate limits): `honeypot_triggered`, `stale_marker_detected`, `repeated_injection_blocks`, `risk_score_spike`, trust failures
- **Deduplication**: Max 3 alerts per event type per instance per 5 minutes (Redis-backed)
- **Plan-gated**: Scout Pro+ only (not available on free Monitor tier)
- **Escalation**: Critical and breach events escalate if unacknowledged

### 11.2 Alert Channels

| Channel | File | Provider | Configuration |
|---------|------|----------|---------------|
| Telegram | `telegram.ts` | Telegram Bot API | `botToken`, `chatId` |
| Email | `email.ts` | Resend.com | `apiKey`, `from`, `to` |
| Slack | `slack.ts` | Slack Webhook | `webhookUrl` |
| Discord | `discord.ts` | Discord Webhook | `webhookUrl` |
| SMS | `sms.ts` | Twilio | `accountSid`, `authToken`, `from`, `to` |
| WhatsApp | `whatsapp.ts` | Twilio | `accountSid`, `authToken`, `from`, `to` |

All channels implement the `AlertAdapter` interface:

```
AlertAdapter {
  send(event: AlertEvent, channel: AlertChannel): Promise<void>
}
```

### 11.3 Throttling (`throttle.ts`)

**File:** `src/alerts/throttle.ts`

- Per-tenant, per-severity 5-minute throttle window
- Max 1 alert per event type per 5 minutes
- Aggregated counter: 11+ alerts in 1 hour triggers escalation

### 11.4 Escalation (`escalation.ts`)

**File:** `src/alerts/escalation.ts`

Two-phase escalation:

| Phase | Time | Behavior |
|-------|------|----------|
| Phase 1 | After 5 minutes unacknowledged | Re-send with `[ESCALATING]` prefix |
| Phase 2 | After 15 minutes unacknowledged | Emergency re-escalation to all channels |

Checks database `acknowledged` field on security events.

### 11.5 Alert Types (`types.ts`)

**File:** `src/alerts/types.ts`

| Type | Values |
|------|--------|
| `AlertSeverity` | `info` (1), `warning` (2), `critical` (3), `breach` (4) |
| `AlertChannel` | `channel_type`, `severity_threshold`, `enabled`, `config` (JSONB) |
| `AlertAdapter` | `send(event, channel) => Promise<void>` |

---

## 12. PROXY MODULE

**File:** `src/proxy/index.ts`

Re-exports from `integration/scout-proxy.ts`. Provides an OpenAI-compatible reverse proxy on port 8080 that transparently applies all Scout security policies to proxied requests.

---

## 13. API LAYER; COMPLETE ENDPOINT MAP

### 13.1 Public Endpoints (No Authentication)

| Method | Path | Purpose | Cache |
|--------|------|---------|-------|
| `GET` | `/api/public/trust` | Public trust API; agent trust scores and attestations | 60s |
| `GET` | `/api/public/trust/verify/:agentId` | Trust-gating verification endpoint |; |
| `GET` | `/api/readiness` | Health check / readiness probe |; |

### 13.2 Carina Agent Endpoints (API Key Required)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/events` | Core event ingestion with session lineage building |
| `POST` | `/api/heartbeat` | Agent heartbeat / instance registration |
| `GET` | `/api/status` | Instance status query |
| `GET` | `/api/stream` | SSE event streaming (real-time) |
| `POST` | `/api/policy/evaluate` | Policy decision evaluation for a tool call |
| `POST` | `/api/policy/context` | Context firewall evaluation for content |
| `GET` | `/api/stats` | Usage statistics |
| `GET` | `/api/dashboard` | Dashboard data aggregation |
| `GET` | `/api/admin/scout/markers` | Current moving-target markers |
| `GET` | `/api/anomalies/*` | Anomaly detection queries |
| `GET` | `/api/rate-limit/*` | Rate limit status queries |
| `GET` | `/api/memory/*` | Memory session access (Carina integration) |
| `GET` | `/api/instances/*` | Instance management queries |
| `GET` | `/api/audit` | Audit log search |

### 13.3 Scout Pro Endpoints (API Key + Scout Pro Plan)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/kill` | Kill/suspend an instance (triggers forensic snapshot) |
| `POST` | `/api/resume` | Resume a suspended instance |
| `POST` | `/api/sessions/block` | Block a session |
| `GET/POST` | `/api/quarantine/*` | Quarantine management |
| `GET/POST` | `/api/egress/*` | Egress filter configuration |
| `GET/POST` | `/api/killswitch/*` | Kill switch status and control |
| `GET/POST` | `/api/honeypots/*` | Honeypot management |
| `GET/POST` | `/api/deception/*` | Deception layer management |
| `POST` | `/api/jit/*` | JIT privilege requests |
| `GET/POST` | `/api/surface/*` | Attack surface management |
| `GET/POST` | `/api/response-terminal` | Response terminal for human-in-the-loop |
| `POST` | `/api/simulation/dry-run` | Attack simulation (sandboxed) |
| `GET/POST` | `/api/auto-remediation/*` | Auto-remediation configuration |
| `GET/POST` | `/api/policy-packs/*` | Policy pack management |
| `GET/POST` | `/api/tripwires/*` | Tripwire management |
| `GET` | `/api/export` | JSON/CSV/PDF export of security data |
| `GET/POST` | `/api/compliance/*` | GDPR SAR/erasure requests |
| `GET` | `/api/security/posture` | Security posture summary |
| `GET/POST` | `/api/trust/*` | Trust management (attestations, verifications) |
| `GET` | `/api/incidents/*` | Incident queries and history |
| `GET/POST` | `/api/approvals/*` | Approval workflow management |

### 13.4 Admin Endpoints (Operator Auth or Browser Session)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/governance/*` | Governance posture, PDF, JSON |
| `GET` | `/api/governance/templates` | Industry compliance templates |
| `POST` | `/api/internal/provision-tenant` | Tenant provisioning |
| `POST` | `/api/internal/sync-plan` | Subscription plan sync |

### 13.5 Account Management (Session Auth)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/account/register` | Account registration |
| `POST` | `/account/login` | Account login |
| `POST` | `/account/logout` | Account logout |
| `GET` | `/account/events` | Account-scoped security events |
| `POST` | `/account/api-keys` | Create API key (returns `lsk_` prefix) |
| `DELETE` | `/account/api-keys/:id` | Revoke API key |
| `GET` | `/account/instances` | Account's Carina instances |
| `GET/POST` | `/account/trust-settings` | Trust configuration |
| `GET` | `/account/onboarding` | Onboarding checklist |

---

## 14. LIBRARY MODULE

### 14.1 Core Libraries

| File | Purpose |
|------|---------|
| `accounts.ts` | Full account lifecycle: bcrypt password hashing, SHA256 API key hashing (`lsk_` prefix), setup tokens (`ast_` prefix, 7-day TTL), license keys (`scout_live_`/`scout_test_` prefixes), Carina tenant provisioning |
| `instance-control.ts` | Suspend/resume instances via Redis pub/sub on `labyrinth:control` channel, forensic snapshot triggering |
| `secret-crypto.ts` | AES-256-GCM encryption with `enc:v1:` prefix for encrypted-at-rest secrets |
| `session-lineage.ts` | Parent/root session ID tracking, attempt numbering, trigger type classification (webhook/taskflow/chat/retry/branch) |
| `pending-approvals.ts` | Approval workflow: pending/approved/rejected/expired states, 15-min TTL (max 1 hour), SSE broadcasting of approval status |
| `subscription-plan.ts` | Plan tiers: `scout_monitor`, `scout_pro`, `scout_standard`, `enterprise`. `isScoutProPlan()` gate function |
| `carina.ts` | Carina API client for memory session integration |
| `alert-channels.ts` | Channel loading and syncing from database |
| `trust-settings.ts` | Account trust configuration management |
| `platform-settings.ts` | Platform security settings with GUI/env variable tracking |
| `scope.ts` | Authorization scoping utilities |
| `cors.ts` | CORS origin resolution |
| `format-event-display.ts` | Security event display formatting |
| `constants.ts` | Control channel names, status constants |
| `policy-audit.ts` | Policy decision auditing |
| `industry-template-policy.ts` | Industry template policy enforcement |
| `industry-template-store.ts` | Template storage and retrieval |
| `simple-pdf.ts` | Lightweight PDF generation (text-based, no external dependency) |
| `episodic-memory.ts` | Carina episodic memory integration |

### 14.2 Account Lifecycle (`accounts.ts`)

#### API Key Format

```
lsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
│   └── 40 hex chars (SHA256 hash of actual key)
└── "Labyrinth Scout Key" prefix
```

The actual key is returned once at creation time and SHA256-hashed for storage.

#### Setup Token Format

```
ast_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
│   └── 40 hex chars
└── "Account Setup Token" prefix
```

7-day TTL. Used for initial tenant provisioning.

#### License Key Format

```
scout_live_xxxxxxxxxxxx  (production)
scout_test_xxxxxxxxxxxx  (test/evaluation)
```

### 14.3 Session Lineage (`session-lineage.ts`)

Tracks the genealogy of every session:

| Field | Purpose |
|-------|---------|
| `parent_session_id` | Session that spawned this one |
| `root_session_id` | Original ancestor session |
| `attempt_number` | Retry/branch counter |
| `trigger_type` | `webhook` / `taskflow` / `chat` / `retry` / `branch` |

This enables full traceability: "Session X was triggered by a webhook that originated from Session Y which was a chat session."

### 14.4 Pending Approvals (`pending-approvals.ts`)

**States:** `pending` → `approved` | `rejected` | `expired`

| Property | Value |
|----------|-------|
| Default TTL | 15 minutes |
| Maximum TTL | 1 hour |
| Notification | SSE broadcast to dashboard |

### 14.5 Subscription Plans (`subscription-plan.ts`)

| Plan ID | Name | Gate |
|---------|------|------|
| `scout_monitor` | Scout Monitor (Free) | Base tier |
| `scout_pro` | Scout Pro (£79/mo) | `isScoutProPlan()` returns true |
| `scout_govern` | Scout Govern (£79/mo) | `isScoutProPlan()` returns true |
| `enterprise` | Enterprise (Custom) | `isScoutProPlan()` returns true |

### 14.6 Secret Cryptography (`secret-crypto.ts`)

**Algorithm:** AES-256-GCM
**Prefix:** `enc:v1:` (versioned for future algorithm upgrades)

All sensitive secrets (private keys, API keys, tokens) stored in the database are encrypted with this scheme.

---

## 15. SDK REFERENCE

### 15.1 Node.js SDK (`@verlox/labyrinth-scout` v0.2.0)

**Location:** `labyrinth-scout-sdk/`

#### Client (`client.ts`; 260 lines)

| Method | Purpose |
|--------|---------|
| `emit(event)` | Send security event to Scout |
| `heartbeat()` | Send agent heartbeat |
| `register(instance)` | Register a new agent instance |
| `instanceStatus()` | Query instance status |
| `policyEvaluate(tool, context)` | Evaluate tool policy |
| `waitForApproval(approvalId)` | Poll for approval (14-minute timeout) |
| `evaluateAndWait(tool, context)` | Evaluate policy + wait for approval if needed |
| `policyContext(content, sourceType)` | Run context firewall |
| `killSwitchStatus()` | Check kill switch state |
| `report(event)` / `reportToolCall(event)` | v0.1 compatibility |
| `checkStatus()` | Health check |
| `startKillSwitchPolling()` | Begin kill switch monitoring |
| `streamUrl()` / `streamUrlWithAuth()` | Get SSE stream URL |

#### Middleware (`middleware.ts`)

`scoutMiddleware`: Express middleware factory for drop-in Scout integration.

#### Wrap (`wrap.ts`)

`scoutWrap(target)`: JavaScript Proxy-based function wrapping for zero-code integration.

#### Kill Switch Monitoring

| Class | Method | Purpose |
|-------|--------|---------|
| `KillSwitchWatcher` | Polling (interval) | Periodic kill switch status checks |
| `KillSwitchSseWatcher` | SSE | Real-time kill switch status via Server-Sent Events |

#### Types (`types.ts`)

Complete TypeScript type definitions for all SDK interfaces.

#### Exports (`index.ts`)

Re-exports with `LabyrinthScoutClient` compatibility alias for v0.1 users.

#### Included Adapters

Same 6 adapters as the server (carina, openai, hermes, langchain, openclaw, generic).

### 15.2 Python SDK

**Location:** `labyrinth_scout/` (Python package)

| File | Purpose |
|------|---------|
| `client.py` | Synchronous Scout client |
| `async_client.py` | Async Scout client (asyncio) |
| `types.py` | Python type definitions |

---

## 16. DATABASE SCHEMA

### 16.1 Table Inventory (21 Tables)

| # | Table | Primary Key | Immutable? | Purpose |
|---|-------|-------------|------------|---------|
| 1 | `security_events` | UUID | No | All security events from monitored agents |
| 2 | `carina_instances` | TEXT (id) | No | Registered agent instances |
| 3 | `alert_channels` | UUID | No | Configured alert notification channels |
| 4 | `anomaly_baselines` | UUID | No | Baseline metrics for anomaly detection |
| 5 | `anomaly_scores` | UUID | No | Computed anomaly scores |
| 6 | `honeypots` | UUID | No | Deployed honeypot credentials |
| 7 | `blocked_sessions` | TEXT (session_id) | No | Manually blocked sessions |
| 8 | `accounts` | UUID | No | Tenant accounts |
| 9 | `account_api_keys` | UUID | No | Tenant API keys (hashed) |
| 10 | `account_setup_tokens` | UUID | No | One-time setup tokens |
| 11 | `scout_platform_settings` | TEXT (key) | No | Global platform configuration |
| 12 | `marker_rotations` | UUID | No | Moving-target marker history |
| 13 | `throttle_state` | Composite (tenant_id, severity, event_type) | No | Alert throttle counters |
| 14 | `killswitch_state` | UUID | No | Kill switch state records |
| 15 | `audit_log` | UUID | **YES (RLS append-only)** | Immutable audit trail |
| 16 | `compliance_requests` | UUID | No | GDPR SAR/erasure requests |
| 17 | `trust_identities` | TEXT (slug) | No | ERC-8004 agent identities |
| 18 | `trust_attestations` | UUID | No | ERC-8004 attestation records |
| 19 | `trust_verifications` | UUID | No | ERC-8126 verification records |
| 20 | `forensic_snapshots` | UUID | No | Instance state snapshots |
| 21 | `critical_event_attestations` | UUID | No | Cryptographic event attestation chain |
| 22 | `pending_approvals` | (from migration) | No | Human-in-the-loop approval queue |

### 16.2 Detailed Column Definitions

#### `security_events`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Unique event identifier |
| `severity` | TEXT | CHECK (info/warning/critical/breach) | Event severity |
| `source` | TEXT |; | Origin of the event |
| `event_type` | TEXT |; | Categorized event type |
| `description` | TEXT |; | Human-readable description |
| `metadata` | JSONB |; | Structured event data |
| `ip_address` | TEXT |; | Source IP |
| `session_id` | UUID |; | Session identifier |
| `instance_id` | TEXT | FK → carina_instances | Agent instance |
| `mitigated` | BOOLEAN |; | Whether threat was neutralized |
| `created_at` | TIMESTAMP | INDEXED | Event timestamp |
| `acknowledged` | BOOLEAN |; | Operator acknowledged flag |
| `parent_session_id` | UUID | INDEXED | Parent session for lineage |
| `root_session_id` | UUID | INDEXED | Root session for lineage |

#### `carina_instances`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | TEXT | PK |
| `name` | TEXT |; |
| `api_key` | TEXT |; |
| `status` | TEXT | CHECK (active/suspended/offline), INDEXED |
| `suspension_reason` | TEXT |; |
| `last_heartbeat` | TIMESTAMP |; |
| `account_id` | UUID | FK → accounts, INDEXED |

#### `alert_channels`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `channel_type` | TEXT | CHECK (telegram/email/slack/discord/sms/whatsapp) |
| `severity_threshold` | INTEGER | Minimum severity to trigger |
| `enabled` | BOOLEAN |; |
| `config` | JSONB | Channel-specific configuration |

#### `accounts`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `email` | TEXT | UNIQUE |
| `password_hash` | TEXT | bcrypt |
| `carina_tenant_id` | UUID | UNIQUE |
| `trust_settings` | JSONB | Account trust configuration |
| `subscription_plan` | TEXT | Plan identifier |

#### `account_api_keys`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `account_id` | UUID | FK → accounts |
| `key_hash` | TEXT | UNIQUE, SHA256 of actual key |
| `key_prefix` | TEXT | First 8 chars for identification |
| `label` | TEXT | Human-readable label |
| `last_used_at` | TIMESTAMP | Last usage |
| `revoked_at` | TIMESTAMP | NULL if active |

#### `audit_log`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | TEXT | INDEXED |
| `event_type` | TEXT | CHECK (tool_execution/model_request/security/admin/auth), INDEXED |
| `action` | TEXT |; |
| `detail` | JSONB | Structured payload |
| `severity` | TEXT | INDEXED |
| `session_id` | UUID |; |
| `ip_address` | INET |; |
| `admin_email` | TEXT |; |
| `timestamp` | TIMESTAMP | INDEXED (with event_type) |

**RLS Policy:** INSERT-only for application role. No UPDATE or DELETE permitted.

#### `trust_identities`

| Column | Type | Constraints |
|--------|------|-------------|
| `slug` | TEXT | PK |
| `name` | TEXT |; |
| `agent_uri` | TEXT |; |
| `chain_id` | INTEGER |; |
| `registry_address` | TEXT | ERC-8004 contract |
| `agent_id` | TEXT | On-chain agent ID |
| `wallet_address` | TEXT |; |
| `register_tx_hash` | TEXT | Registration transaction |
| `status` | TEXT | CHECK (pending/registering/live/failed) |

#### `trust_attestations`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `identity_slug` | TEXT | FK → trust_identities, INDEXED |
| `namespace` | TEXT | Schema namespace |
| `tag` | TEXT | Attestation tag |
| `score` | INTEGER | Attestation score |
| `attestation_uid` | TEXT | On-chain UID |
| `tx_hash` | TEXT | Submission transaction |
| `chain_id` | INTEGER |; |
| `metrics` | JSONB | Computed metrics |
| `comment` | TEXT |; |
| `status` | TEXT | CHECK (submitted/failed) |
| `submitted_at` | TIMESTAMP | INDEXED |

#### `trust_verifications`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `identity_slug` | TEXT | FK → trust_identities, INDEXED |
| `agent_id` | TEXT |; |
| `chain_id` | INTEGER |; |
| `wav_risk_score` | INTEGER | WAV component |
| `wv_risk_score` | INTEGER | WV component |
| `unified_risk_score` | INTEGER | Average of WAV + WV |
| `trust_response_score` | INTEGER | Trust response score |
| `request_hash` | TEXT |; |
| `request_tx_hash` | TEXT |; |
| `response_tx_hash` | TEXT |; |
| `response_uri` | TEXT |; |
| `status` | TEXT | CHECK (submitted/failed) |
| `details` | JSONB | Verification details |

#### `critical_event_attestations`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `event_id` | UUID | FK → security_events, UNIQUE |
| `event_type` | TEXT |; |
| `severity` | TEXT |; |
| `instance_id` | TEXT |; |
| `content_hash` | TEXT | SHA256 of event content |
| `chain_hash` | TEXT | Sequential hash (includes previous) |
| `signature` | TEXT | HMAC-SHA256 signature |
| `on_chain_status` | TEXT | CHECK (off_chain/queued/submitted) |

### 16.3 Key Indexes

| Table | Index On | Purpose |
|-------|----------|---------|
| `security_events` | `created_at` | Time-range queries |
| `security_events` | `severity` | Severity filtering |
| `security_events` | `instance_id` | Per-instance queries |
| `security_events` | `event_type` | Event type filtering |
| `security_events` | `parent_session_id`, `root_session_id` | Session lineage |
| `security_events` | `acknowledged` | Escalation queries |
| `carina_instances` | `status` | Active instance queries |
| `carina_instances` | `account_id` | Tenant scoping |
| `honeypots` | `instance_id`, `triggered_at` | Honeypot queries |
| `honeypots` | `value` | Leak scanning |
| `honeypots` | `triggered_at IS NULL AND retired_at IS NULL` | Active honeypots |
| `audit_log` | `tenant_id` | Tenant scoping |
| `audit_log` | `event_type`, `severity`, `timestamp` | Search filtering |
| `audit_log` | `event_type`, `timestamp` | Retention cleanup |
| `compliance_requests` | `status`, `due_by` | SLA monitoring |
| `compliance_requests` | `tenant_id` | Tenant scoping |
| `anomaly_baselines` | UNIQUE(`instance_id`, `metric_name`) | Baseline lookup |
| `trust_*` | `identity_slug`, `submitted_at` | Trust queries |

---

## 17. SECURITY MECHANISMS; COMPLETE SUMMARY

### 17.1 Mechanism Index

| # | Mechanism | Layer | Threat Addressed |
|---|-----------|-------|------------------|
| 1 | API Key Authentication (dual-mode) | Auth | Unauthorized access |
| 2 | TOTP 2FA (RFC 6238) | Auth | Credential theft |
| 3 | IP Whitelist | Auth | Network-level attacks |
| 4 | Timing-safe Key Comparison | Auth | Timing side-channel attacks |
| 5 | Prompt Injection Defense (3-layer) | Input | Prompt injection/payload attacks |
| 6 | Egress URL Allowlist | Output | Data exfiltration |
| 7 | Sensitive Data Scanning | Output | Credential/secret leakage |
| 8 | Tool Policy Enforcement (3 tiers) | Runtime | Unauthorized tool usage |
| 9 | Dangerous Command Detection | Runtime | System compromise |
| 10 | Redis Token Bucket Rate Limiting | Runtime | Resource exhaustion/abuse |
| 11 | Confirmation Gates | Runtime | Destructive actions |
| 12 | Policy Decision Engine | Runtime | Multi-factor policy evaluation |
| 13 | Session Shield Modes (4 levels) | Runtime | Compromised session containment |
| 14 | Anomaly Detection (Z-score, 7 heuristics) | Detection | Unknown/novel attacks |
| 15 | Honeypots (5 categories) | Deception | Credential theft detection |
| 16 | Moving-Target Markers | Deception | Prompt exfiltration/composition |
| 17 | Stale Marker Detection | Deception | Delayed prompt injection |
| 18 | Tool Name Obfuscation | Deception | Tool enumeration |
| 19 | Auto-Remediation (5 cases) | Response | Automated threat response |
| 20 | Global Kill Switch | Response | Emergency containment |
| 21 | Graceful Shutdown (4-phase) | Response | Clean agent termination |
| 22 | Cryptographic Attestation Chain | Forensics | Tamper-evident event logging |
| 23 | ERC-8004 On-Chain Identity | Trust | Agent accountability |
| 24 | ERC-8126 On-Chain Verification | Trust | Trust scoring/risk verification |
| 25 | Immutable Audit Log (RLS) | Audit | Tamper-proof audit trail |
| 26 | AES-256-GCM Secret Encryption | Storage | Secrets at rest |
| 27 | Alert Throttling + Deduplication | Alerting | Alert fatigue prevention |
| 28 | Alert Escalation (2-phase) | Alerting | Unacknowledged critical events |
| 29 | Context Firewall (6 actions) | Input/Output | Multi-source content filtering |
| 30 | Risk-Based Shield Transitions | Runtime | Adaptive security posture |

### 17.2 Defense-in-Depth Diagram

```
                    ┌─────────────────────────────┐
                    │      API AUTHENTICATION       │
                    │  (Dual-mode, TOTP, IP allow)  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │       PROMPT GUARD           │
                    │   Layer 1: Regex (13 patterns)│
                    │   Layer 2: LLM Judge         │
                    │   Layer 3: Output Scan       │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │     CONTEXT FIREWALL         │
                    │  (pass/redact/annotate/      │
                    │   downgrade/block/isolate)    │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼────────┐
    │  TOOL POLICY   │  │    EGRESS      │  │    ANOMALY      │
    │  (Tiers, Rate  │  │   (URL allow,  │  │  (Z-score, 7    │
    │   Limiting,    │  │   Data Scan)   │  │   Heuristics)   │
    │   Dangerous    │  │                │  │                  │
    │   Commands)    │  │                │  │                  │
    └─────────┬──────┘  └────────┬───────┘  └────────┬────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │    POLICY GATEWAY            │
                    │  (Unified Decision Engine)   │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼──────┐  ┌────────▼───────┐  ┌────────▼────────┐
    │ SESSION SHIELD │  │ AUTO-REMEDIATE │  │   KILL SWITCH   │
    │ (observe→guard │  │  (5 cases)     │  │  (ARMED/        │
    │  →restrict→    │  │                │  │   TRIGGERED)    │
    │   quarantine)  │  │                │  │                  │
    └─────────┬──────┘  └────────┬───────┘  └────────┬────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │   AUDIT + ALERTING           │
                    │  (Immutable log, channels,   │
                    │   throttling, escalation)     │
                    └─────────────────────────────┘
```

### 17.3 Response Status Codes for Security Blocks

| HTTP Status | Meaning | Scout Context |
|-------------|---------|---------------|
| 200 | Allowed | Policy passed; request forwarded |
| 403 | Forbidden | Blocked by policy/shield/quarantine |
| 428 | Precondition Required | Human approval needed |
| 429 | Too Many Requests | Rate limit exceeded |
| 503 | Service Unavailable | Kill switch active |

---

## 18. PRICING TIERS

| Tier | Price | Event Ingestion | Prompt Shield | Kill Switch | Audit Log | Tool Policy | Deception | Egress Filter | Alert Channels | Anomaly Detection | Compliance | Attestations |
|------|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Scout Monitor** | Free |  |; |; |; |; |; |; |; |; |; |; |
| **Scout Pro** | £79/mo |  |  |  |  |  |; |; | 1 channel |; |; | Weekly |
| **Scout Govern** | £79/mo |  |  |  |  |  |  |  | 6 channels |  |  | Weekly |
| **Enterprise** | Custom |  |  |  |  |  |  |  | All |  |  | Daily + dedicated |

### Feature Breakdown by Tier

#### Scout Monitor (Free)
- Basic event ingestion and heartbeat tracking
- Status dashboard
- Instance registration
- Public trust API access

#### Scout Pro (£79/mo)
Everything in Monitor, plus:
- Prompt injection shield (3-layer defense)
- Global kill switch (ARM/TRIGGER)
- Immutable audit log
- Tool policy enforcement (tiers, rate limiting, dangerous commands)
- 1 alert channel (choose from Telegram, Email, Slack, Discord, SMS, or WhatsApp)
- Session shield modes
- Weekly ERC-8004 attestations
- JIT privilege grants

#### Scout Govern (£79/mo)
Everything in Pro, plus:
- Full deception layer (honeypots, moving targets, markers)
- Egress filtering (URL allowlist, data leak detection)
- All 6 alert channels
- Anomaly detection (Z-score, 7 heuristics)
- Compliance reports (GDPR SAR/erasure)
- Auto-remediation
- Context firewall
- Forensic snapshots
- Attack surface management
- Policy packs

#### Enterprise (Custom Pricing)
Everything in Standard, plus:
- Daily attestations (vs. weekly)
- Dedicated Scout instance
- Custom SLA
- All integration adapters
- Priority support
- Custom policy packs
- Industry template customization
- Multi-tenant management dashboard

---

## 19. PUBLIC DASHBOARDS

### 19.1 Operator Dashboard (`dashboard.html`)

**File:** `public/dashboard.html` (~3127 lines)

Dark cyberpunk-themed real-time monitoring interface.

**Design:**
- Color palette: `--void` (deep black), `--navy` (dark blue), `--green` (terminal green), `--red` (alert red), `--amber` (warning), `--cyan` (accent)
- CRT boot animation on load
- Grid background with scanline overlay
- SSE live connection to `/api/stream` for real-time updates

**Widgets (19 JS files):**

| Widget | File | Purpose |
|--------|------|---------|
| Defense Tab | `defense-tab.js` | Defense overview and controls |
| Governance Tab | `governance-tab.js` | Governance compliance view |
| Fleet Overview | `fleet.js` | All monitored agents |
| Agent Status | `agent-status.js` | Per-agent health and metrics |
| Threat Metrics | `threat-metrics.js` | Real-time threat statistics |
| Incident Timeline | `incident-timeline.js` | Chronological security events |
| Audit Log | `audit-log.js` | Immutable audit trail viewer |
| Compliance Report | `compliance-report.js` | GDPR/regulatory status |
| Kill Switch | `kill-switch.js` | Kill switch control panel |
| Live Feed | `live-feed.js` | Real-time event stream |
| Posture Summary | `posture-summary.js` | Security posture overview |
| Response Terminal | `response-terminal.js` | Human-in-the-loop interface |
| Trust History | `trust-history.js` | Trust score over time |
| Usage Analytics | `usage-analytics.js` | Tool usage and rate analytics |
| Action Queue | `action-queue.js` | Pending approvals and actions |
| Attack Detail | `attack-detail.js` | Detailed attack forensics |
| Dashboard Help | `dashboard-help.js` | In-app documentation |
| Charts | `charts.js` | Visualization engine |
| Events Table | `events-table.js` | Tabular event browser |

**Additional Widgets:**
- `alerts-feed.js`; Live alert stream
- `risk-gauge.js`; Risk score gauge visualization
- `threat-timeline.js`; Threat chronology
- `session-map.js`; Session lineage visualization
- `tool-heatmap.js`; Tool usage heatmap
- `egress-monitor.js`; Outbound request monitoring
- `honeypot-monitor.js`; Honeypot status and triggers
- `compliance-score.js`; Framework compliance scoring
- `trust-score.js`; Trust score visualization
- `attestation-timeline.js`; On-chain attestation history
- `instance-status.js`; Instance health monitoring
- `model-usage.js`; LLM token/model usage
- `channel-map.js`; Alert channel status
- `approval-queue.js`; Human approval queue
- `theme.js`; Theme management

### 19.2 Governance Dashboard (`governance.html`)

**File:** `public/governance.html` (~270 lines)

Compliance-focused dashboard with:
- Overall compliance score banner
- EU AI Act risk tier display
- UK DSIT alignment status
- Framework readiness cards (EU AI Act, GDPR, SOC2, ISO 42001)
- Prioritized action items list
- On-chain attestation timeline
- Agent governance table (per-agent compliance status)
- PDF/JSON export buttons

---

## 20. SCRIPTS & DEPLOYMENT

### 20.1 CLI Scripts

| Script | Purpose |
|--------|---------|
| `bin/scout-disarm.ts` | Emergency kill switch disarming CLI |
| `scripts/deploy-scout.sh` | Full deployment pipeline |
| `scripts/apply-nginx-console.sh` | Nginx reverse proxy configuration |
| `scripts/doctor.ts` | System health diagnostics |
| `scripts/register-trust-identity.ts` | ERC-8004 on-chain identity registration (testnet) |
| `scripts/register-trust-identity-mainnet.ts` | ERC-8004 on-chain identity registration (mainnet) |
| `scripts/submit-trust-attestation.ts` | Manual trust attestation submission |
| `scripts/submit-trust-verification.ts` | ERC-8126 verification submission |

### 20.2 Deploy Scout (`deploy-scout.sh`)

Full deployment pipeline:
1. Environment validation (SCOUT_API_KEY required)
2. Database migration check
3. Redis connectivity verification
4. Trust identity registration (if configured)
5. Service startup
6. Health check verification

### 20.3 Doctor (`doctor.ts`)

System health diagnostics that verify:
- Database connectivity and migration status
- Redis connectivity
- Trust SDK initialization
- Alert channel configuration
- Kill switch state
- Active instance count
- Recent security events

### 20.4 Nginx Configuration (`apply-nginx-console.sh`)

Applies a production Nginx reverse proxy configuration for:
- `console.labyrinthscout.com` → Scout dashboard (port 4444)
- WebSocket/SSE upgrade support for live streaming
- SSL termination (via Certbot/LetsEncrypt)
- Rate limiting at the reverse proxy level

---

## 21. DOCUMENTATION SITE

Built with VitePress. Located at `docs/`.

### Site Structure

| Section | Pages |
|---------|-------|
| **Getting Started** | index, getting-started, configuration, dashboard, troubleshooting |
| **API Reference** | events, heartbeat, honeypots, kill-switch, public-trust, status, stream |
| **Security** | anomaly-detection, egress-filter, honeypots, prompt-guard, threat-model, tool-policy |
| **Trust** | platform, least-privilege-defaults, type3-runbook, schema |
| **Integration** | carina, custom-agent, docker |
| **SDK** | node, python |

---

## 22. OPERATIONAL RUNBOOKS

### 22.1 Type 3 Incident Response (Reasoning Compromise)

When a Type 3 incident (reasoning compromise) is detected:

1. **Verify**: Check anomaly scores and attestation chain
2. **Contain**: Escalate session to `quarantine` mode
3. **Capture**: Trigger forensic snapshot
4. **Investigate**: Review audit log and session lineage
5. **Attest**: Submit critical event attestation on-chain
6. **Remediate**: Apply auto-remediation rules
7. **Report**: Generate compliance report for regulatory filing

### 22.2 Kill Switch Activation

When the kill switch is TRIGGERED:

1. All new requests rejected immediately
2. In-flight requests complete within 1 second (Phase 2)
3. Remaining connections terminated within 3 seconds (Phase 3)
4. All alert channels notified within 5 seconds (Phase 4)
5. Active instances suspended
6. Forensic snapshots captured
7. Audit event recorded
8. On-chain attestation submitted (if configured)

### 22.3 Honeypot Triggered Protocol

When a honeypot is triggered:

1. Event logged as `breach` severity in `security_events`
2. Instance immediately escalated to `quarantine` mode
3. Honeypot marked as `triggered` with IP and metadata
4. Alert dispatched to ALL channels (never-throttled)
5. Critical event attestation submitted on-chain
6. Forensic snapshot captured

### 22.4 GDPR Subject Access Request (SAR)

1. POST to `/api/compliance/sar` (Scout Pro+)
2. System creates `compliance_requests` row with `due_by = now + 30 days`
3. `data-access-request.ts` queries all tenant tables
4. JSON export generated
5. Response delivered to requestor's email
6. Audit event logged

### 22.5 GDPR Right to Erasure

1. POST to `/api/compliance/erasure` (Scout Pro+)
2. System creates `compliance_requests` row
3. `data-deletion.ts` anonymizes PII:
   - `email` → `[ERASED]`
   - `password_hash` → `[ERASED]`
   - All PII in `metadata` JSONB fields → `[REDACTED]`
4. Referential integrity preserved (FKs remain intact)
5. Audit events preserved (immutable audit_log unaffected)
6. Confirmation sent to requestor

---

## APPENDIX A: FILE REFERENCE MAP

```
src/
├── server.ts                          # Main entry point
├── config/index.ts                    # Configuration
├── db.ts                              # PostgreSQL pool
├── redis.ts                           # Redis client
├── migrations.ts                      # Schema migrations
├── types.ts                           # Core types
├── cli.ts                             # CLI entry
├── scheduler.ts                       # Cron jobs
├── middleware/
│   ├── auth.ts                        # API key auth
│   ├── operator-auth.ts               # Operator dual-auth
│   ├── provision-auth.ts              # Provision secret auth
│   ├── account-session.ts             # Session auth
│   └── plan-gate.ts                   # Plan enforcement
├── security/
│   ├── anomaly-detector.ts            # Anomaly detection engine
│   ├── anomaly-types.ts               # Anomaly type definitions
│   ├── prompt-guard.ts                # 3-layer prompt defense
│   ├── egress-filter.ts               # URL allowlist + data scan
│   ├── tool-policy.ts                 # Tool policy enforcer
│   ├── tool-tiers.ts                  # FREE/PRO/ENTERPRISE definitions
│   ├── policy-gateway.ts              # Central decision engine
│   ├── policy-decisions.ts            # Decision types
│   ├── session-shield.ts              # Escalating shield modes
│   ├── context-firewall.ts            # Multi-source content filter
│   ├── risk-registry.ts               # Risk score definitions
│   ├── risk-transitions.ts            # Auto-escalation triggers
│   ├── auto-remediation.ts            # Automatic responses
│   ├── honeypot-manager.ts            # Decoy credential management
│   ├── attack-surface.ts              # Surface restrictions
│   ├── jit-privileges.ts              # JIT privilege grants
│   ├── policy-packs.ts                # Policy pack system
│   ├── shield-report.ts               # Shield status reports
│   ├── forensic-snapshot.ts           # Instance state capture
│   ├── honeypot-prompt-block.ts       # System prompt honeypots
│   └── tripwire-registry.ts           # Tripwire events
├── deception/
│   ├── moving-target.ts               # Moving-target markers
│   ├── stale-marker-detector.ts       # Retired marker detection
│   ├── rotation-scheduler.ts          # Rotation timers
│   └── decoy-generator.ts             # Decoy block generation
├── audit/
│   ├── audit-logger.ts                # Immutable audit writer
│   ├── audit-schemas.ts               # Audit type definitions
│   ├── audit-search.ts                # Search + PDF export
│   ├── audit-retention.ts             # Retention enforcement
│   ├── data-access-request.ts         # GDPR SAR
│   ├── data-deletion.ts               # GDPR Erasure
│   ├── gdpr-report.ts                 # GDPR compliance
│   └── retention-policy.ts            # Retention configuration
├── governance/
│   ├── regulatory-classification.ts   # EU AI Act classifier
│   ├── framework-scorer.ts            # 4-framework scoring
│   ├── build-governance-posture.ts    # Posture aggregation
│   ├── board-report-pdf.ts            # PDF report generation
│   └── industry-templates.ts          # Sector templates
├── trust/
│   ├── chain-config.ts                # Blockchain configuration
│   ├── create-trust-sdk.ts            # Trust SDK initialization
│   ├── register-erc8004.ts            # ERC-8004 registration
│   ├── attestation-adapter.ts         # Attestation submission
│   ├── attestation-namespace.ts       # Schema/namespace definitions
│   ├── attestation-metrics.ts         # Metrics computation
│   ├── compute-trust-metrics.ts       # Risk score formula
│   ├── build-public-trust.ts          # Public trust payload
│   ├── load-trust-identity.ts         # Identity loading
│   ├── load-trust-attestations.ts     # Attestation loading
│   ├── trust-history.ts               # Score history
│   ├── trust-alerts.ts                # Trust event alerts
│   ├── risk-spike-monitor.ts          # Score spike detection
│   ├── incident-types.ts              # Type 1/2/3 classification
│   ├── compliance-report.ts           # Trust compliance
│   ├── run-weekly-attestation.ts      # Scheduled attestations
│   ├── critical-event-attestation.ts  # Cryptographic chain
│   └── erc8126/
│       ├── verification-types.ts      # WAV/WV types
│       ├── compute-wav-score.ts       # WAV computation
│       ├── compute-wv-score.ts        # WV computation
│       ├── run-weekly-verification.ts # Scheduled verification
│       ├── load-verifications.ts      # Load from DB
│       └── validation-registry.ts     # Contract interactions
├── integration/
│   ├── agent-adapter.interface.ts     # Adapter interface
│   ├── adapter-registry.ts            # Adapter resolution
│   ├── carina-adapter.ts              # Carina adapter
│   ├── openai-adapter.ts              # OpenAI adapter
│   ├── hermes-adapter.ts              # Hermes adapter
│   ├── langchain-adapter.ts           # LangChain adapter
│   ├── openclaw-adapter.ts            # OpenClaw adapter
│   ├── generic-adapter.ts             # Generic fallback
│   ├── security-pipeline.ts           # Inspection pipeline
│   ├── scout-middleware.ts            # Express middleware
│   ├── scout-wrap.ts                  # Proxy wrapper
│   └── scout-proxy.ts                 # Reverse proxy
├── alerts/
│   ├── dispatcher.ts                  # Alert routing
│   ├── telegram.ts                    # Telegram adapter
│   ├── email.ts                       # Email adapter (Resend)
│   ├── slack.ts                       # Slack adapter
│   ├── discord.ts                     # Discord adapter
│   ├── sms.ts                         # SMS adapter (Twilio)
│   ├── whatsapp.ts                    # WhatsApp adapter (Twilio)
│   ├── throttle.ts                    # Alert throttling
│   ├── escalation.ts                  # 2-phase escalation
│   └── types.ts                       # Alert type definitions
├── killswitch/
│   ├── global-kill-switch.ts          # State machine
│   ├── graceful-shutdown.ts           # 4-phase shutdown
│   └── kill-switch-audit.ts           # Audit recording
├── lib/
│   ├── accounts.ts                    # Account lifecycle
│   ├── instance-control.ts            # Instance suspend/resume
│   ├── secret-crypto.ts               # AES-256-GCM
│   ├── session-lineage.ts             # Session genealogy
│   ├── pending-approvals.ts           # Approval workflow
│   ├── subscription-plan.ts           # Plan tiers
│   ├── carina.ts                      # Carina API client
│   ├── alert-channels.ts              # Channel sync
│   ├── trust-settings.ts              # Trust config
│   ├── platform-settings.ts           # Platform config
│   ├── scope.ts                       # Auth scoping
│   ├── cors.ts                        # CORS resolution
│   ├── format-event-display.ts        # Display formatting
│   ├── constants.ts                   # Channel/status constants
│   ├── policy-audit.ts                # Policy auditing
│   ├── industry-template-policy.ts    # Template enforcement
│   ├── industry-template-store.ts     # Template storage
│   ├── simple-pdf.ts                  # PDF generation
│   └── episodic-memory.ts             # Memory integration
└── proxy/
    └── index.ts                       # Proxy re-exports
```

## APPENDIX B: NPM DEPENDENCIES

| Package | Purpose |
|---------|---------|
| `express` ^5 | Web framework |
| `express-session` | Session management |
| `pg` | PostgreSQL client |
| `ioredis` | Redis client |
| `chalk` | Terminal colors |
| `bcrypt` | Password hashing |
| `@open-agent-economy/trust-sdk` | On-chain trust integration |
| `vitepress` | Documentation site |

## APPENDIX C: CONFIGURATION QUICK REFERENCE

### Required Settings
```
SCOUT_API_KEY=<your-operator-api-key>
```

### Optional Settings
```
SCOUT_PORT=4444
SCOUT_COOKIE_SECURE=false
SCOUT_CORS_ORIGIN=https://console.labyrinthscout.com
SCOUT_PROXY_ENABLED=false
SCOUT_PROXY_PORT=8080
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Trust Settings (for on-chain features)
```
TRUST_ATTESTER_PRIVATE_KEY=<private-key-hex>
TRUST_CHAIN_ID=84532
TRUST_CHAIN_RPC=https://sepolia.base.org
TRUST_ATTESTATION_ENABLED=true
TRUST_VERIFICATION_ENABLED=true
TRUST_ATTESTATION_INTERVAL_DAYS=7
TRUST_VERIFICATION_INTERVAL_DAYS=7
```

---

*This document is the single authoritative reference for Labyrinth Scout. All modules, mechanisms, endpoints, tables, integrations, and operational procedures are documented herein. For source-level detail, consult the TypeScript files directly at `/opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com/src/`.*
