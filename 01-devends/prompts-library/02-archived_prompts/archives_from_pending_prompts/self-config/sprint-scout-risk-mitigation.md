# Sprint: Scout Risk Mitigation Layer; Automated Security for Self-Modifying Carina

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

## What This Builds

Scout (Carina's security sibling; 77 security tools, kill switch, quarantine, egress control, SSE event stream) becomes the automated guardian of Carina's self-modification capability. Not just manual operator tools; continuous automated detection, alerting, and response.

Scout monitors every tool generation, every sandbox execution, every network call, every persisted tool. When something looks wrong, Scout acts; quarantines the tool, blocks the session, alerts the operator, or pulls the kill switch.

## Prerequisites

All three self-config prompts must be built first:
1. Credential store (self-configuration)
2. Sandboxed tool generation (dynamic tools)
3. Auth gate (passphrase + locks)

Scout itself is already built and deployed. This prompt wires Scout INTO the self-modification pipeline.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CARINA RUNTIME                        │
│                                                          │
│  Tool Generation  ──▶  Sandbox  ──▶  Output  ──▶  Use   │
│       │                  │             │                 │
│       │                  │             │                 │
│       ▼                  ▼             ▼                 │
│  ┌──────────────────────────────────────────────┐       │
│  │           SCOUT SECURITY LAYER                │       │
│  │                                               │       │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │       │
│  │  │ Event   │  │ Anomaly  │  │ Automated    │  │       │
│  │  │ Logger  │  │ Detector │  │ Response     │  │       │
│  │  └────┬────┘  └────┬─────┘  └──────┬──────┘  │       │
│  │       │            │               │          │       │
│  │       ▼            ▼               ▼          │       │
│  │  ┌──────────────────────────────────────┐    │       │
│  │  │         SCOUT ENGINE (port 4444)      │    │       │
│  │  │                                       │    │       │
│  │  │  • security_events table              │    │       │
│  │  │  • Redis pub/sub (labyrinth:control)  │    │       │
│  │  │  • Kill switch API                    │    │       │
│  │  │  • Tool quarantine API                │    │       │
│  │  │  • Egress control API                 │    │       │
│  │  │  • SSE event stream                   │    │       │
│  │  │  • Alert dispatch (Telegram/email)    │    │       │
│  │  └──────────────────────────────────────┘    │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│                         ▼                                │
│              OPERATOR TELEGRAM ALERT                     │
│   "WARNING Scout: Unusual tool generation pattern detected. │
│    Tool 'data_exporter' quarantined. Review required."   │
└─────────────────────────────────────────────────────────┘
```

---

## Part 1: Security Event Taxonomy; What Scout Watches

Define every self-modification event as a typed security event in Scout's `security_events` table.

Create `src/security/self-mod-events.ts`:

```typescript
/**
 * Event types for Carina's self-modification pipeline.
 * Every event flows through Scout's security_events table
 * and the SSE event stream to the dashboard.
 */

export const SELF_MOD_EVENT_TYPES = {
  // Generation lifecycle
  TOOL_GEN_REQUESTED:    'tool_gen.requested',      // Passphrase entered, generation started
  TOOL_GEN_AUTH_FAILED:  'tool_gen.auth_failed',    // Wrong passphrase (count toward lockout)
  TOOL_GEN_AUTH_LOCKOUT: 'tool_gen.auth_lockout',   // 3 failures → 24h lockout triggered
  TOOL_GEN_CODE_GENERATED:'tool_gen.code_generated', // LLM returned tool code
  TOOL_GEN_STATIC_SCAN:  'tool_gen.static_scan',    // Static scanner result (pass/fail + violations)
  TOOL_GEN_SANDBOX_RUN:  'tool_gen.sandbox_run',    // Sandbox execution result
  TOOL_GEN_SANDBOX_FAIL: 'tool_gen.sandbox_failed', // Sandbox rejected or crashed
  TOOL_GEN_COMPLETED:    'tool_gen.completed',       // Tool generated and returned successfully
  
  // Persistence
  TOOL_PERSIST_REQUESTED:'tool_persist.requested',   // Operator asked to save
  TOOL_PERSIST_AUTH_FAIL: 'tool_persist.auth_failed', // Wrong passphrase on persist
  TOOL_PERSIST_SAVED:    'tool_persist.saved',       // Tool saved as pending
  TOOL_APPROVED:         'tool_approved',             // Operator activated persistent tool
  TOOL_REJECTED:         'tool_rejected',             // Operator rejected tool
  TOOL_DISABLED:         'tool_disabled',             // Previously active tool disabled
  
  // Risk indicators
  TOOL_FETCH_DENIED:     'tool.fetch_denied',         // Tool tried fetch() to unapproved domain
  TOOL_INJECTION_BLOCKED:'tool.injection_blocked',    // Output sanitizer caught prompt injection
  TOOL_CONCURRENCY_BLOCK:'tool.concurrency_blocked',  // Second generation blocked by mutex
  TOOL_RAPID_GENERATION: 'tool.rapid_generation',     // >3 generations in 10 minutes (anomaly)
  TOOL_HIGH_RISK_PATTERN:'tool.high_risk_pattern',    // Code matches known-dangerous patterns
  
  // Scout automated responses
  SCOUT_AUTO_QUARANTINE: 'scout.auto_quarantine',     // Scout auto-quarantined a tool
  SCOUT_AUTO_SUSPEND:    'scout.auto_suspend',        // Scout auto-suspended an instance
  SCOUT_ALERT_SENT:      'scout.alert_sent',          // Alert dispatched to operator
} as const;

export type SelfModEventType = typeof SELF_MOD_EVENT_TYPES[keyof typeof SELF_MOD_EVENT_TYPES];

/**
 * Severity mapping for automated response decisions.
 */
export const EVENT_SEVERITY: Record<string, 'info' | 'warning' | 'critical'> = {
  'tool_gen.requested':            'info',
  'tool_gen.auth_failed':          'warning',
  'tool_gen.auth_lockout':         'critical',
  'tool_gen.code_generated':       'info',
  'tool_gen.static_scan':          'info',
  'tool_gen.sandbox_run':          'info',
  'tool_gen.sandbox_failed':       'warning',
  'tool_gen.completed':            'info',
  'tool_persist.requested':        'info',
  'tool_persist.auth_failed':      'warning',
  'tool_persist.saved':            'info',
  'tool_approved':                 'info',
  'tool_rejected':                 'info',
  'tool_disabled':                 'info',
  'tool.fetch_denied':             'warning',
  'tool.injection_blocked':        'critical',
  'tool.concurrency_blocked':      'warning',
  'tool.rapid_generation':         'critical',
  'tool.high_risk_pattern':        'critical',
  'scout.auto_quarantine':         'warning',
  'scout.auto_suspend':            'critical',
  'scout.alert_sent':              'info',
};
```

---

## Part 2: Event Logger; Wire Every Gate Into Scout

Every gate in the self-modification pipeline must emit security events.

Create `src/security/self-mod-logger.ts`:

```typescript
import { pool } from '../memory/db.js';
import { SELF_MOD_EVENT_TYPES, EVENT_SEVERITY } from './self-mod-events.js';

export async function logSelfModEvent(
  type: keyof typeof SELF_MOD_EVENT_TYPES,
  detail: Record<string, unknown>,
): Promise<void> {
  const eventType = SELF_MOD_EVENT_TYPES[type];
  const severity = EVENT_SEVERITY[eventType] ?? 'info';

  // Write to security_events table via the project's existing pg Pool
  await pool.query(
    `INSERT INTO security_events (event_type, severity, detail, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [eventType, severity, JSON.stringify(detail)],
  );
  
  // Publish to Redis for real-time SSE
  // Import redis client from wherever the project exposes it (e.g. src/gateway/redis.ts or config)
  const { getRedisClient } = await import('../config/index.js');
  const redisClient = getRedisClient?.();
  if (redisClient) {
    await redisClient.publish('labyrinth:events', JSON.stringify({
      type: eventType,
      severity,
      detail,
      timestamp: new Date().toISOString(),
    }));
  }
  // Close the conditional block opened above
}
  
  // Critical events also trigger an immediate operator alert
  if (severity === 'critical') {
    await dispatchOperatorAlert(eventType, detail);
  }
}

/**
 * Send critical alert to operator via Telegram.
 */
async function dispatchOperatorAlert(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const message = formatAlertMessage(eventType, detail);
  
  // Send via Carina's Telegram bot
  // (Uses the existing send-message tool or bot API directly)
  await sendTelegramAlert(message);
}

function formatAlertMessage(eventType: string, detail: Record<string, unknown>): string {
  const emoji = {
    'tool_gen.auth_lockout': '[LOCKOUT]',
    'tool.injection_blocked': '[BLOCKED]',
    'tool.rapid_generation': '[WARNING]',
    'tool.high_risk_pattern': '[CRITICAL]',
    'scout.auto_quarantine': '[QUARANTINE]',
    'scout.auto_suspend': '[SUSPEND]',
  }[eventType] ?? '[WARNING]';
  
  return `${emoji} **Scout Alert: ${eventType}**
  
${detail.reason || detail.warning || 'No additional detail.'}

Action taken: ${detail.action_taken || 'None; operator review required.'}
Time: ${new Date().toISOString()}
Instance: ${detail.instance_id || 'carina-core'}`;
}
```

---

## Part 3: Integration Points; Where Scout Hooks In

### 3.1 Hook Into the Auth Gate

Modify `src/tools/dynamic/auth-gate.ts` to emit events:

```typescript
// In authorizeGeneration():
if (!verified) {
  recordFailedAttempt();
  await logSelfModEvent('TOOL_GEN_AUTH_FAILED', {
    attempts_remaining: Math.max(0, MAX_FAILED_ATTEMPTS - lockoutState.failedAttempts),
  });
  // ... existing error response
}

// When lockout triggers:
if (lockoutState.failedAttempts >= MAX_FAILED_ATTEMPTS) {
  lockoutState.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  await logSelfModEvent('TOOL_GEN_AUTH_LOCKOUT', {
    locked_until: new Date(lockoutState.lockedUntil).toISOString(),
    failed_attempts: lockoutState.failedAttempts,
  });
}
```

### 3.2 Hook Into Tool Generation

Modify `src/tools/dynamic/generate-and-run.ts`:

```typescript
// After passphrase validation:
await logSelfModEvent('TOOL_GEN_REQUESTED', {
  task_description: args.task_description.slice(0, 200),
  session_id: context.sessionId,
});

// After LLM generates code:
await logSelfModEvent('TOOL_GEN_CODE_GENERATED', {
  tool_name: generated.name,
  code_length: generated.code.length,
  code_hash: crypto.createHash('sha256').update(generated.code).digest('hex'),
});

// After static scan:
await logSelfModEvent('TOOL_GEN_STATIC_SCAN', {
  tool_name: generated.name,
  passed: scanResult.safe,
  violations: scanResult.safe ? [] : scanResult.blocked,
});

// After sandbox execution:
await logSelfModEvent(sandboxResult.success ? 'TOOL_GEN_SANDBOX_RUN' : 'TOOL_GEN_SANDBOX_FAIL', {
  tool_name: generated.name,
  duration_ms: sandboxResult.durationMs,
  error: sandboxResult.error || null,
});

// On completion:
await logSelfModEvent('TOOL_GEN_COMPLETED', {
  tool_name: generated.name,
  persisted: saved,
  total_duration_ms: Date.now() - generationStartTime,
});
```

### 3.3 Hook Into Tool Persistence

Modify `src/tools/dynamic/persist-tool.ts`:

```typescript
await logSelfModEvent('TOOL_PERSIST_SAVED', {
  tool_name: args.tool_name,
  fetch_domains: args.fetch_allowed_domains || '(none)',
  code_hash: tool.sourceCodeHash,
  risk_level: tool.riskLevel,
});
```

### 3.4 Hook Into Output Sanitizer

Modify `src/sandbox/output-sanitizer.ts` to emit when it blocks something:

```typescript
if (!sanitized.safe) {
  await logSelfModEvent('TOOL_INJECTION_BLOCKED', {
    tool_name: generated.name,
    blocked_patterns: sanitized.blockedPatterns,
    output_sample: JSON.stringify(raw).slice(0, 500),
    action_taken: 'Tool output blocked. Tool NOT saved. Operator alerted.',
  });
}
```

### 3.5 Hook Into Fetch Gatekeeper

Modify `src/sandbox/fetch-gatekeeper.ts`:

```typescript
// When a tool tries to call fetch() to an unapproved domain:
if (!isDomainAllowed(hostname, allowlist)) {
  await logSelfModEvent('TOOL_FETCH_DENIED', {
    tool_name: currentToolName,
    attempted_domain: hostname,
    allowed_domains: allowlist,
    action_taken: 'Request blocked.',
  });
  throw new Error(`Domain ${hostname} not in allowlist.`);
}
```

---

## Part 4: Automated Anomaly Detection

Scout doesn't just log; it detects patterns and acts.

Create `src/security/anomaly-detector.ts`:

```typescript
import { pool } from '../memory/db.js';
import { logSelfModEvent } from './self-mod-logger.js';

/**
 * Scout's anomaly detection for self-modification.
 * Runs after every security event. Checks for patterns that
 * indicate abuse, compromise, or malfunction.
 */

// ── Thresholds ──────────────────────────────────────────────

const RAPID_GEN_THRESHOLD = 3; // Generations in window
const RAPID_GEN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PENDING_TOOLS = 10; // Cap on unapproved tools
const MAX_FAILED_GENERATIONS = 5; // Failed gens in 1 hour → alert

// ── Detection Functions ─────────────────────────────────────

/**
 * Check for rapid tool generation; could indicate:
 * - Carina is stuck in a loop generating tools
 * - Operator session is compromised and attacker is generating tools
 * - LLM is hallucinating tool generation requests
 */
export async function checkRapidGeneration(): Promise<void> {
  const windowStart = new Date(Date.now() - RAPID_GEN_WINDOW_MS).toISOString();
  
  const count = await pool.query(
    `SELECT COUNT(*) as c FROM security_events 
     WHERE event_type = 'tool_gen.requested' 
     AND created_at > $1`,
    [windowStart],
  );
  
  if (count.rows[0].c >= RAPID_GEN_THRESHOLD) {
    await logSelfModEvent('TOOL_RAPID_GENERATION', {
      generation_count: count.rows[0].c,
      window_minutes: RAPID_GEN_WINDOW_MS / 60000,
      action_taken: 'All generated tools in this window auto-quarantined. Operator alerted.',
    });
    
    // Auto-quarantine all recently generated tools
    await quarantineAllRecentTools();
    
    // Alert operator
    await sendTelegramAlert(
      `WARNING: Rapid Tool Generation Detected\n\n` +
      `${count.rows[0].c} tool generations in ${RAPID_GEN_WINDOW_MS / 60000} minutes.\n` +
      `All recent tools have been quarantined.\n` +
      `Review at: https://console.labyrinthscout.com/dashboard`
    );
  }
}

/**
 * Check for high-risk code patterns in generated tools.
 * Runs during static scan phase.
 */
export function detectHighRiskPatterns(code: string): string[] {
  const patterns = [
    {
      name: 'credential_extraction',
      pattern: /process\.env\.(?!CARINA_|SCOUT_)/,
      reason: 'Attempts to read non-Carina environment variables',
    },
    {
      name: 'file_exfiltration',
      pattern: /fetch\(.*btoa\(/,
      reason: 'Encodes data before sending; possible exfiltration',
    },
    {
      name: 'command_execution',
      pattern: /child_process|exec\s*\(|spawn\s*\(/,
      reason: 'Attempts to execute system commands',
    },
    {
      name: 'crypto_mining',
      pattern: /while\s*\(\s*true\s*\).*hash|sha256|md5/,
      reason: 'Potential CPU-bound loop with hashing',
    },
    {
      name: 'large_data_upload',
      pattern: /fetch\(.*JSON\.stringify\(params/,
      reason: 'Uploads all input parameters; possible data leak',
    },
  ];
  
  const detected: string[] = [];
  for (const { name, pattern, reason } of patterns) {
    if (pattern.test(code)) {
      detected.push(`${name}: ${reason}`);
    }
  }
  
  return detected;
}

/**
 * Check pending tool count; if too many are unapproved, something may be wrong.
 */
export async function checkPendingToolBloat(): Promise<void> {
  const count = await pool.query(
    `SELECT COUNT(*) as c FROM runtime_tools WHERE status = 'pending'`,
  );
  
  if (count.rows[0].c > MAX_PENDING_TOOLS) {
    await sendTelegramAlert(
      `INFO: Pending Tool Bloat\n\n` +
      `${count.rows[0].c} tools are pending approval.\n` +
      `Review and approve or reject at: https://ops.carinaai.uk/tools/runtime`
    );
  }
}

/**
 * Check failed generation rate.
 */
export async function checkFailedGenerationRate(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const count = await pool.query(
    `SELECT COUNT(*) as c FROM security_events 
     WHERE event_type IN ('tool_gen.sandbox_failed', 'tool_gen.static_scan')
     AND detail->>'passed' = 'false'
     AND created_at > $1`,
    [oneHourAgo],
  );
  
  if (count.rows[0].c >= MAX_FAILED_GENERATIONS) {
    await sendTelegramAlert(
      `WARNING: High Tool Generation Failure Rate\n\n` +
      `${count.rows[0].c} failed generations in the last hour.\n` +
      `Possible causes: LLM issues, sandbox configuration error, or attack attempts.`
    );
  }
}

/**
 * Check for CVE-relevant version exposure.
 */
export async function checkVulnerableDependencies(): Promise<void> {
  // Check isolated-vm version
  const ivmVersion = await getPackageVersion('isolated-vm');
  
  // Known vulnerable versions (update this list)
  const vulnerableVersions: Array<{ package: string; range: string; cve: string; severity: string }> = [
    // Example; update when CVEs are published
    // { package: 'isolated-vm', range: '<4.7.0', cve: 'CVE-2024-XXXX', severity: 'high' },
  ];
  
  for (const vuln of vulnerableVersions) {
    if (vuln.package === 'isolated-vm' && isVersionInRange(ivmVersion, vuln.range)) {
      await sendTelegramAlert(
        `CRITICAL: Vulnerable Dependency Detected\n\n` +
        `Package: ${vuln.package} v${ivmVersion}\n` +
        `CVE: ${vuln.cve} (${vuln.severity})\n` +
        `Fix: Upgrade to version outside range ${vuln.range}\n\n` +
        `WARNING: Tool generation is automatically DISABLED until this is patched.`
      );
      
      // Auto-disable tool generation
      await disableToolGeneration();
    }
  }
}
```

---

## Part 5: Automated Response; Scout Acts Without Waiting

When anomaly detection fires, Scout can act automatically based on severity.

Create `src/security/auto-response.ts`:

```typescript
/**
 * Automated Scout responses to self-modification threats.
 * 
 * Response levels:
 *   LEVEL 1 (warning): Quarantine specific tool, alert operator
 *   LEVEL 2 (critical): Block operator session, quarantine all recent tools
 *   LEVEL 3 (emergency): Pull kill switch, suspend Carina entirely
 */

export enum ResponseLevel {
  WARNING = 1,   // Quarantine tool + alert
  CRITICAL = 2,  // Block session + quarantine all
  EMERGENCY = 3, // Kill switch
}

interface AutoResponseConfig {
  // Events that trigger each level
  triggers: Record<string, ResponseLevel>;
  // Whether auto-response is enabled (operator can disable)
  enabled: boolean;
  // Minimum time between automated actions (prevent spam)
  cooldownMs: number;
}

const DEFAULT_CONFIG: AutoResponseConfig = {
  triggers: {
    'tool.injection_blocked':    ResponseLevel.CRITICAL,
    'tool.rapid_generation':     ResponseLevel.CRITICAL,
    'tool.high_risk_pattern':    ResponseLevel.WARNING,
    'tool_gen.auth_lockout':     ResponseLevel.WARNING,
    'tool_gen.sandbox_failed':   ResponseLevel.WARNING,  // Only if >5 in 1h
    'scout.vulnerable_dep':      ResponseLevel.EMERGENCY,
  },
  enabled: true,
  cooldownMs: 60_000, // 1 minute between actions
};

let lastResponseTime = 0;

/**
 * Execute automated response based on event type and severity.
 */
export async function executeAutoResponse(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  if (!DEFAULT_CONFIG.enabled) return;
  
  const level = DEFAULT_CONFIG.triggers[eventType];
  if (!level) return; // No auto-response for this event
  
  // Cooldown check
  if (Date.now() - lastResponseTime < DEFAULT_CONFIG.cooldownMs) {
    console.log(`Auto-response cooldown active. Skipping ${eventType}.`);
    return;
  }
  
  lastResponseTime = Date.now();
  
  switch (level) {
    case ResponseLevel.WARNING:
      await respondWarning(eventType, detail);
      break;
    case ResponseLevel.CRITICAL:
      await respondCritical(eventType, detail);
      break;
    case ResponseLevel.EMERGENCY:
      await respondEmergency(eventType, detail);
      break;
  }
}

async function respondWarning(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const toolName = detail.tool_name as string;
  const instanceId = detail.instance_id as string || 'carina-core';
  
  // Quarantine the specific tool for 60 minutes
  await quarantineTool(toolName, instanceId, 60, `Auto-response to ${eventType}`);
  
  await logSelfModEvent('SCOUT_AUTO_QUARANTINE', {
    event_type: eventType,
    tool_name: toolName,
    duration_minutes: 60,
    reason: `Automated quarantine triggered by ${eventType}`,
  });
}

async function respondCritical(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const instanceId = detail.instance_id as string || 'carina-core';
  
  // Block the operator session that triggered this
  await blockSession(detail.session_id as string, `Auto-response to ${eventType}`);
  
  // Quarantine all tools generated in the last hour
  await quarantineAllRecentTools();
  
  // Send urgent Telegram alert
  await sendTelegramAlert(
    `CRITICAL: Scout Auto-Response Activated\n\n` +
    `Trigger: ${eventType}\n` +
    `Session blocked. All recent tools quarantined.\n` +
    `Review immediately at: https://console.labyrinthscout.com/dashboard\n\n` +
    `To re-enable, the operator must acknowledge this alert.`
  );
}

async function respondEmergency(
  eventType: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const instanceId = detail.instance_id as string || 'carina-core';
  
  // Pull the kill switch; suspend Carina
  await suspendInstance(instanceId, `Emergency auto-response to ${eventType}`);
  
  await logSelfModEvent('SCOUT_AUTO_SUSPEND', {
    event_type: eventType,
    reason: `Emergency suspension triggered by ${eventType}`,
  });
  
  // Send critical Telegram alert
  await sendTelegramAlert(
    `EMERGENCY: Carina Suspended by Scout\n\n` +
    `Trigger: ${eventType}\n` +
    `Instance ${instanceId} has been suspended.\n` +
    `All tool execution is blocked.\n` +
    `All self-modification is blocked.\n\n` +
    `To resume: https://console.labyrinthscout.com/dashboard → Resume`
  );
}
```

---

## Part 6: Scheduled Security Checks (Cron Integration)

Some checks run on a schedule, not in response to events.

Create `src/security/scheduled-checks.ts`:

```typescript
/**
 * Scheduled security checks that run via cron or heartbeat.
 * These are passive detections; they look for patterns over time.
 */

export async function runScheduledSecurityChecks(): Promise<void> {
  await checkRapidGeneration();
  await checkFailedGenerationRate();
  await checkPendingToolBloat();
  await checkVulnerableDependencies();
}

/**
 * Daily deep audit: reviews ALL generated tools for suspicious patterns.
 * Runs at 02:00 UTC.
 */
export async function runDailyDeepAudit(): Promise<{
  tools_reviewed: number;
  tools_flagged: number;
  findings: string[];
}> {
  const activeTools = await pool.query(
    `SELECT * FROM runtime_tools WHERE status IN ('active', 'pending')`,
  );
  
  const findings: string[] = [];
  let flagged = 0;
  
  for (const tool of activeTools.rows) {
    // Re-scan code for high-risk patterns
    const risks = detectHighRiskPatterns(tool.source_code);
    if (risks.length > 0) {
      findings.push(`${tool.name}: ${risks.join('; ')}`);
      flagged++;
      
      // Auto-quarantine high-risk tools that were previously approved
      if (tool.status === 'active' && risks.some(r => r.includes('credential') || r.includes('exfiltration'))) {
        await quarantineTool(tool.name, 'carina-core', 1440, 'Daily audit flagged high-risk pattern');
      }
    }
    
    // Check if fetch domains have changed or expired
    if (tool.fetch_allowed_domains) {
      const domains = JSON.parse(tool.fetch_allowed_domains);
      for (const domain of domains) {
        // DNS check; is the domain still resolving?
        // WhoIs check; has the domain changed ownership?
        // (Implementation depends on available DNS/WhoIs tools)
      }
    }
  }
  
  return {
    tools_reviewed: activeTools.rows.length,
    tools_flagged: flagged,
    findings,
  };
}

/**
 * Weekly CVE check for all sandbox dependencies.
 * Runs every Monday at 06:00 UTC.
 */
export async function runWeeklyCVECheck(): Promise<void> {
  const dependencies = ['isolated-vm'];
  
  for (const dep of dependencies) {
    // Check NVD or OSV for recent CVEs
    // Could use: npx auditjs ossi --json
    // Or: curl https://api.osv.dev/v1/query ...
    
    // If critical CVE found → EMERGENCY response
  }
}
```

---

## Part 7: Scout Dashboard Integration

### 7.1 Add Self-Modification Panel to Scout Dashboard

Extend `02-backends/console.labyrinthscout.com/public/dashboard.html` with a new tab: "Self-Mod."

The tab shows:
- **Live feed** of tool generation events (SSE)
- **Active tools** list with risk levels, usage counts, fetch domains
- **Pending approval** queue
- **Quarantine status** for any auto-quarantined tools
- **Auto-response log**; what Scout did and why
- **Kill switch button**; emergency suspend

### 7.2 SSE Event Types for Dashboard

Add these to the SSE stream:

```typescript
// Publish to SSE when events fire:
event: 'self_mod'
data: {"type":"tool_gen.requested","tool":"data_exporter","timestamp":"..."}

event: 'self_mod_alert'
data: {"level":"critical","message":"Rapid generation detected","action":"All tools quarantined"}
```

---

## Part 8: Operator Commands

Scout responds to operator commands for manual control:

```
"Scout, status"           → Show self-mod security status
"Scout, quarantine X"     → Quarantine tool X for 60 min
"Scout, unquarantine X"   → Lift quarantine on tool X
"Scout, suspend"          → Pull kill switch immediately
"Scout, resume"           → Resume after suspension
"Scout, audit tools"      → Run deep audit now
"Scout, disable auto"     → Disable auto-response (dangerous)
"Scout, enable auto"      → Re-enable auto-response
"Scout, acknowledge"      → Acknowledge an alert (clears it)
```

---

## Part 9: Environment Variables

Add to `.env`:

```bash
# Scout self-modification security
SCOUT_SELF_MOD_AUTO_RESPONSE=true     # Enable automated responses
SCOUT_SELF_MOD_AUTO_SUSPEND=true      # Allow auto-suspend (EMERGENCY level)
SCOUT_SELF_MOD_ALERT_TELEGRAM=true    # Send alerts to Telegram
SCOUT_SELF_MOD_DAILY_AUDIT_TIME=02:00 # UTC time for deep audit
SCOUT_SELF_MOD_WEEKLY_CVE_TIME=06:00  # UTC, Monday
```

---

## Part 10: Registration

### 10.1 Start the Scheduled Checks

In `src/index.ts`, add after Scout initialization:

```typescript
import { runScheduledSecurityChecks, runDailyDeepAudit, runWeeklyCVECheck } from './security/scheduled-checks';

// Run anomaly checks every 5 minutes
setInterval(runScheduledSecurityChecks, 5 * 60 * 1000);

// Schedule daily deep audit
schedule('0 2 * * *', runDailyDeepAudit);

// Schedule weekly CVE check (Monday 06:00)
schedule('0 6 * * 1', runWeeklyCVECheck);
```

### 10.2 Register Event Hooks

All self-mod events auto-flow to Scout via `logSelfModEvent()`. No additional registration needed; just import and call.

---

## Verification Checklist

- [ ] Every auth failure generates a `tool_gen.auth_failed` event in security_events
- [ ] Tool generation emits events at every stage (requested → code_generated → scanned → sandboxed → completed)
- [ ] Output sanitizer blocking emits `tool.injection_blocked` with blocked patterns
- [ ] Fetch gatekeeper emits `tool.fetch_denied` for unapproved domains
- [ ] Rapid generation (3+ in 10 min) triggers `tool.rapid_generation` + auto-quarantine
- [ ] High-risk code patterns are detected during static scan
- [ ] Daily audit runs and flags suspicious tools
- [ ] Auto-response WARNING level quarantines the tool
- [ ] Auto-response CRITICAL level blocks session + quarantines all
- [ ] Auto-response EMERGENCY level pulls the kill switch
- [ ] Operator receives Telegram alerts for all critical events
- [ ] Scout dashboard shows self-mod events in real-time SSE
- [ ] "Scout, status" returns full security status
- [ ] "Scout, quarantine X" works from chat
- [ ] "Scout, suspend" pulls kill switch immediately
- [ ] Concurrency guard emits event when blocking second generation
- [ ] Lockout events are logged and alert the operator
- [ ] CVE check for isolated-vm runs weekly

---

## Files Summary

| File | Action |
|------|--------|
| `src/security/self-mod-events.ts` | CREATE; event type taxonomy + severity map |
| `src/security/self-mod-logger.ts` | CREATE; event emitter to Scout DB + Redis + Telegram |
| `src/security/anomaly-detector.ts` | CREATE; pattern detection (rapid gen, high-risk, CVE) |
| `src/security/auto-response.ts` | CREATE; 3-level automated response engine |
| `src/security/scheduled-checks.ts` | CREATE; daily audit + weekly CVE check |
| `src/tools/dynamic/auth-gate.ts` | MODIFY; emit events on auth attempts |
| `src/tools/dynamic/generate-and-run.ts` | MODIFY; emit events at every stage |
| `src/tools/dynamic/persist-tool.ts` | MODIFY; emit save events |
| `src/sandbox/fetch-gatekeeper.ts` | MODIFY; emit fetch_denied events |
| `src/sandbox/output-sanitizer.ts` | MODIFY; emit injection_blocked events |
| `src/index.ts` | MODIFY; start scheduled checks |
| `02-backends/console.labyrinthscout.com/public/dashboard.html` | MODIFY; add Self-Mod tab |
| `.env` | MODIFY; add Scout self-mod env vars |

---

## Success Criteria

1. Every action in the self-mod pipeline is logged as a typed Scout security event
2. Operator sees real-time events on the Scout dashboard
3. Rapid generation auto-quarantines tools and alerts operator
4. Prompt injection in sandbox output is detected and blocked before Carina sees it
5. Fetch to unapproved domains is blocked and logged
6. Vulnerable dependencies trigger automatic tool generation disable
7. Daily audit catches patterns missed during generation
8. Operator can pull the kill switch with one command
9. Operator can manually quarantine/unquarantine any tool
10. All critical events reach the operator via Telegram within 30 seconds
