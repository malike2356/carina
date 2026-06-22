**Status: COMPLETED 2026-06-21**

**What was built:** `scan-runner.ts`, `scheduler.ts`, `finding-processor.ts`, tool registry, migrations 001-engine-core.

# Scout 01; Engine Core: Continuous Scanning Engine

**Gap:** 12; Scout Product
**Agent:** Claude Code (primary), Cursor (fallback)
**Effort:** 8 days

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Scout currently has no engine. It's a marketing site with architecture docs. This prompt builds the engine; the thing that actually scans domains, discovers vulnerabilities, and persists findings. Without this, Scout is a brochure. With this, Scout is a product.

The engine runs 25 automated tools on a schedule. Users register targets (domains, IP ranges, URLs). Scout scans them periodically. Results are stored, deduplicated, and surfaced in the dashboard (prompt 03) and alerting pipeline (prompt 04).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SCOUT ENGINE                               │
│                                                               │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │  Scheduler  │──→│ Scan Runner  │──→│ Result Processor │  │
│  │  (cron)     │   │ (orchestrator)│   │ (dedup, score)   │  │
│  └─────────────┘   └──────┬───────┘   └────────┬─────────┘  │
│                           │                     │             │
│                           ▼                     ▼             │
│                    ┌──────────────┐   ┌──────────────────┐  │
│                    │  Tool Pool   │   │  Findings Store  │  │
│                    │  (25 tools)  │   │  (PostgreSQL)    │  │
│                    └──────────────┘   └──────────────────┘  │
│                                                               │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │  Target     │   │  Scan Config │   │  Rate Limiter    │  │
│  │  Registry   │   │  (per-target)│   │  (politeness)   │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Module 1: Database

**File:** `scout-engine/src/db/migrations/001-engine-core.sql`

```sql
-- Targets: what Scout scans
CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,                          -- "Production Web Server"
  type TEXT NOT NULL CHECK (type IN ('domain', 'ip', 'ip_range', 'url')),
  value TEXT NOT NULL,                         -- "example.com", "10.0.0.1", "10.0.0.0/24"
  schedule TEXT NOT NULL DEFAULT 'weekly',     -- 'hourly', 'daily', 'weekly', 'monthly'
  enabled BOOLEAN DEFAULT TRUE,
  last_scan_at TIMESTAMP,
  next_scan_at TIMESTAMP,
  scan_config JSONB DEFAULT '{}',             -- Per-target tool config overrides
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, type, value)
);

-- Scan runs: each time Scout scans a target
CREATE TABLE IF NOT EXISTS scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id),
  workspace_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  tools_run INTEGER DEFAULT 0,
  tools_failed INTEGER DEFAULT 0,
  findings_total INTEGER DEFAULT 0,
  findings_new INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tool executions within a scan run
CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id UUID NOT NULL REFERENCES scan_runs(id),
  tool_name TEXT NOT NULL,                     -- 'nmap', 'nuclei', 'amass', etc.
  tool_category TEXT NOT NULL,                 -- 'recon', 'vuln_scan', 'ids'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  exit_code INTEGER,
  raw_output TEXT,
  raw_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Findings: what Scout discovered
CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id UUID NOT NULL REFERENCES scan_runs(id),
  target_id UUID NOT NULL REFERENCES targets(id),
  workspace_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  finding_type TEXT NOT NULL CHECK (finding_type IN (
    'open_port', 'service', 'subdomain', 'vulnerability', 'cve',
    'exposed_secret', 'misconfiguration', 'certificate_issue',
    'suspicious_activity', 'intrusion_alert', 'compliance_gap'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB,                              -- Raw tool output, structured
  affected_host TEXT,
  affected_port INTEGER,
  cve_id TEXT,                                 -- CVE-2026-XXXX if applicable
  cvss_score DECIMAL(3,1),                     -- CVSS score if applicable
  cvss_vector TEXT,                            -- CVSS vector string
  remediation TEXT,                            -- Suggested fix
  reference_urls TEXT[],                       -- Links to advisories
  fingerprint TEXT,                            -- Dedup key: hash of type+host+port+title
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  seen_count INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'false_positive', 'remediated', 'wont_fix', 'duplicate')),
  resolved_at TIMESTAMP,
  resolved_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unique index to prevent duplicate findings
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_fingerprint
  ON findings(fingerprint, target_id)
  WHERE status NOT IN ('false_positive', 'duplicate');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_findings_workspace ON findings(workspace_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_findings_target ON findings(target_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_cve ON findings(cve_id) WHERE cve_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_runs_target ON scan_runs(target_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_run ON tool_executions(scan_run_id);

-- Asset inventory: discovered assets across all scans
CREATE TABLE IF NOT EXISTS discovered_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('domain', 'subdomain', 'ip', 'service', 'url', 'certificate')),
  value TEXT NOT NULL,
  source_tool TEXT NOT NULL,                   -- Which tool discovered this
  source_target_id UUID REFERENCES targets(id),
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(workspace_id, asset_type, value)
);
```

---

## Module 2: Tool Pool; 25 Automated Tools

**File:** `scout-engine/src/tools/registry.ts`

```typescript
// scout-engine/src/tools/registry.ts

export interface ScoutTool {
  name: string;
  category: 'recon' | 'vuln_scan' | 'fuzzing' | 'ids' | 'reporting';
  command: string; // Template: "nmap -sV -sC {target}"
  timeout: number; // Max execution time in seconds
  priority: number; // Execution order (lower = earlier)
  producesFindings: boolean;
  findingMapping?: {                   // How to parse tool output into finding fields
    type: string;
    severityExtractor: string; // Regex or JSON path
    titleExtractor: string;
  };
  rateLimit: {                         // Politeness controls
    maxConcurrent: number;
    delayBetweenTargets: number; // ms
  };
}

export const SCOUT_TOOLS: ScoutTool[] = [

  // ════════════════════════════════════════════════
  // RECONNAISSANCE (6 tools)
  // ════════════════════════════════════════════════

  {
    name: 'nmap',
    category: 'recon',
    command: 'nmap -sV -sC -p- --open -oX - {target}',
    timeout: 600,
    priority: 1,
    producesFindings: true,
    findingMapping: {
      type: 'open_port',
      severityExtractor: 'port.service ? (port.service.tunnel === "ssl" ? "medium" : "low") : "info"',
      titleExtractor: 'port.service.product || port.service.name',
    },
    rateLimit: { maxConcurrent: 2, delayBetweenTargets: 5000 },
  },
  {
    name: 'amass',
    category: 'recon',
    command: 'amass enum -passive -d {target} -json -',
    timeout: 300,
    priority: 1,
    producesFindings: true,
    findingMapping: {
      type: 'subdomain',
      severityExtractor: '"info"',
      titleExtractor: 'name',
    },
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 10000 },
  },
  {
    name: 'theHarvester',
    category: 'recon',
    command: 'theHarvester -d {target} -b all -f /tmp/harvester_{target}',
    timeout: 180,
    priority: 2,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 15000 },
  },
  {
    name: 'shodan',
    category: 'recon',
    command: 'shodan domain {target}',
    timeout: 30,
    priority: 2,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 2000 },
  },
  {
    name: 'censys',
    category: 'recon',
    command: 'censys search "services.tls.certificates.leaf_data.subject.common_name:{target}"',
    timeout: 30,
    priority: 3,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 3000 },
  },
  {
    name: 'masscan',
    category: 'recon',
    command: 'masscan {target} -p1-65535 --rate=1000 -oJ -',
    timeout: 300,
    priority: 2,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 30000 },
  },

  // ════════════════════════════════════════════════
  // VULNERABILITY SCANNING (5 tools)
  // ════════════════════════════════════════════════

  {
    name: 'nuclei',
    category: 'vuln_scan',
    command: 'nuclei -u {target} -severity critical,high,medium -json -',
    timeout: 600,
    priority: 5,
    producesFindings: true,
    findingMapping: {
      type: 'vulnerability',
      severityExtractor: 'info.severity',
      titleExtractor: 'info.name',
    },
    rateLimit: { maxConcurrent: 2, delayBetweenTargets: 5000 },
  },
  {
    name: 'openvas',
    category: 'vuln_scan',
    command: 'gvm-cli scan --target {target} --format json',
    timeout: 1800,
    priority: 6,
    producesFindings: true,
    findingMapping: {
      type: 'vulnerability',
      severityExtractor: 'severity',
      titleExtractor: 'name',
    },
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 60000 },
  },
  {
    name: 'nikto',
    category: 'vuln_scan',
    command: 'nikto -h {target} -Format json',
    timeout: 600,
    priority: 4,
    producesFindings: true,
    rateLimit: { maxConcurrent: 2, delayBetweenTargets: 10000 },
  },
  {
    name: 'wapiti',
    category: 'vuln_scan',
    command: 'wapiti -u {target} --format json',
    timeout: 900,
    priority: 6,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 30000 },
  },
  {
    name: 'sslscan',
    category: 'vuln_scan',
    command: 'sslscan --no-colour {target}',
    timeout: 120,
    priority: 3,
    producesFindings: true,
    findingMapping: {
      type: 'certificate_issue',
      severityExtractor: 'status === "accepted" ? "low" : "medium"',
    },
    rateLimit: { maxConcurrent: 3, delayBetweenTargets: 3000 },
  },

  // ════════════════════════════════════════════════
  // FUZZING (3 tools)
  // ════════════════════════════════════════════════

  {
    name: 'ffuf',
    category: 'fuzzing',
    command: 'ffuf -u {target}/FUZZ -w /usr/share/wordlists/dirb/common.txt -json',
    timeout: 300,
    priority: 7,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 20000 },
  },
  {
    name: 'wfuzz',
    category: 'fuzzing',
    command: 'wfuzz -c -z file,/usr/share/wordlists/wfuzz/general/common.txt --hc 404 {target}/FUZZ',
    timeout: 300,
    priority: 8,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 20000 },
  },
  {
    name: 'dirb',
    category: 'fuzzing',
    command: 'dirb {target} /usr/share/wordlists/dirb/common.txt',
    timeout: 300,
    priority: 7,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 20000 },
  },

  // ════════════════════════════════════════════════
  // INTRUSION DETECTION (5 tools; monitoring, not active scanning)
  // ════════════════════════════════════════════════

  {
    name: 'snort',
    category: 'ids',
    command: 'snort -A console -q -c /etc/snort/snort.conf -i eth0',
    timeout: 0,                              // Continuous; runs as daemon
    priority: 99,
    producesFindings: true,
    findingMapping: {
      type: 'intrusion_alert',
      severityExtractor: 'priority === 1 ? "critical" : priority === 2 ? "high" : "medium"',
      titleExtractor: 'msg',
    },
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 0 },
  },
  {
    name: 'suricata',
    category: 'ids',
    command: 'suricata -c /etc/suricata/suricata.yaml -i eth0',
    timeout: 0,                              // Continuous
    priority: 99,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 0 },
  },
  {
    name: 'zeek',
    category: 'ids',
    command: 'zeek -i eth0 local',
    timeout: 0,                              // Continuous
    priority: 99,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 0 },
  },
  {
    name: 'wireshark',
    category: 'ids',
    command: 'tshark -i eth0 -a duration:300',
    timeout: 300,
    priority: 10,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 60000 },
  },
  {
    name: 'tcpdump',
    category: 'ids',
    command: 'tcpdump -i eth0 -c 10000 -w /tmp/scout_{target}.pcap',
    timeout: 300,
    priority: 10,
    producesFindings: false,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 60000 },
  },

  // ════════════════════════════════════════════════
  // REPORTING (6 tools; post-scan processing)
  // ════════════════════════════════════════════════

  {
    name: 'whatweb',
    category: 'recon',
    command: 'whatweb {target} --log-json=-',
    timeout: 120,
    priority: 3,
    producesFindings: true,
    rateLimit: { maxConcurrent: 2, delayBetweenTargets: 3000 },
  },
  {
    name: 'dnsrecon',
    category: 'recon',
    command: 'dnsrecon -d {target} -j -',
    timeout: 120,
    priority: 2,
    producesFindings: true,
    rateLimit: { maxConcurrent: 2, delayBetweenTargets: 5000 },
  },
  {
    name: 'gobuster',
    category: 'fuzzing',
    command: 'gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt --json',
    timeout: 300,
    priority: 7,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 20000 },
  },
  {
    name: 'testssl',
    category: 'vuln_scan',
    command: 'testssl --json {target}',
    timeout: 300,
    priority: 3,
    producesFindings: true,
    rateLimit: { maxConcurrent: 3, delayBetweenTargets: 5000 },
  },
  {
    name: 'httpx',
    category: 'recon',
    command: 'httpx -u {target} -json',
    timeout: 60,
    priority: 3,
    producesFindings: true,
    rateLimit: { maxConcurrent: 3, delayBetweenTargets: 2000 },
  },
  {
    name: 'subfinder',
    category: 'recon',
    command: 'subfinder -d {target} -json',
    timeout: 180,
    priority: 2,
    producesFindings: true,
    rateLimit: { maxConcurrent: 1, delayBetweenTargets: 10000 },
  },
];
```

---

## Module 3: Scan Runner

**File:** `scout-engine/src/engine/scan-runner.ts`

```typescript
// scout-engine/src/engine/scan-runner.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db/index.js';
import { SCOUT_TOOLS, ScoutTool } from '../tools/registry.js';
import { processFindings } from './finding-processor.js';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface ScanContext {
  scanRunId: string;
  targetId: string;
  workspaceId: string;
  targetValue: string;
  targetType: string;
}

export async function runScan(ctx: ScanContext): Promise<void> {
  // Mark scan as running
  await db('scan_runs').where({ id: ctx.scanRunId }).update({
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const tools = SCOUT_TOOLS
    .filter(t => t.priority < 99) // Skip daemon tools during scheduled scans
    .sort((a, b) => a.priority - b.priority);

  let toolsRun = 0;
  let toolsFailed = 0;
  let totalFindings = 0;
  let newFindings = 0;

  for (const tool of tools) {
    try {
      const result = await executeTool(tool, ctx);
      toolsRun++;

      if (tool.producesFindings && result.output) {
        const { total, new_ } = await processFindings(tool, result, ctx);
        totalFindings += total;
        newFindings += new_;
      }
    } catch (err) {
      toolsFailed++;
      await db('tool_executions').insert({
        scan_run_id: ctx.scanRunId,
        tool_name: tool.name,
        tool_category: tool.category,
        status: 'failed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        exit_code: -1,
        raw_error: (err as Error).message,
      });
    }

    // Rate limiting between tools
    await sleep(tool.rateLimit.delayBetweenTargets);
  }

  // Mark scan as completed
  await db('scan_runs').where({ id: ctx.scanRunId }).update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - new Date(ctx.scanRunId).getTime(),
    tools_run: toolsRun,
    tools_failed: toolsFailed,
    findings_total: totalFindings,
    findings_new: newFindings,
  });

  // Update target's next scan time
  await scheduleNextScan(ctx.targetId);
}

async function executeTool(
  tool: ScoutTool,
  ctx: ScanContext,
): Promise<{ output: string; error: string; exitCode: number; durationMs: number }> {
  const executionId = crypto.randomUUID();
  const command = tool.command.replace('{target}', ctx.targetValue);

  await db('tool_executions').insert({
    id: executionId,
    scan_run_id: ctx.scanRunId,
    tool_name: tool.name,
    tool_category: tool.category,
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: tool.timeout * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' },
    });

    const durationMs = Date.now() - startTime;

    await db('tool_executions').where({ id: executionId }).update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      exit_code: 0,
      raw_output: stdout.slice(0, 100000), // Store first 100KB
      raw_error: stderr?.slice(0, 10000),
    });

    return { output: stdout, error: stderr || '', exitCode: 0, durationMs };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;

    await db('tool_executions').where({ id: executionId }).update({
      status: err.killed ? 'timed_out' : 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      exit_code: err.code || -1,
      raw_error: (err.stderr || err.message).slice(0, 10000),
    });

    throw err;
  }
}
```

---

## Module 4: Scheduler

**File:** `scout-engine/src/engine/scheduler.ts`

```typescript
// scout-engine/src/engine/scheduler.ts

import { db } from '../db/index.js';
import { runScan } from './scan-runner.js';
import cron from 'node-cron';

// Every 5 minutes: check for targets due for scanning
cron.schedule('*/5 * * * *', async () => {
  const dueTargets = await db('targets')
    .where({ enabled: true })
    .where('next_scan_at', '<=', new Date().toISOString())
    .orWhereNull('next_scan_at')
    .limit(5); // Process max 5 targets per tick

  for (const target of dueTargets) {
    await scheduleTargetScan(target);
  }
});

async function scheduleTargetScan(target: any): Promise<void> {
  // Create scan run
  const [scanRun] = await db('scan_runs')
    .insert({
      target_id: target.id,
      workspace_id: target.workspace_id,
      status: 'pending',
    })
    .returning('*');

  // Run scan (fire and forget; scheduler continues to next target)
  runScan({
    scanRunId: scanRun.id,
    targetId: target.id,
    workspaceId: target.workspace_id,
    targetValue: target.value,
    targetType: target.type,
  }).catch(err => {
    console.error(`Scan failed for target ${target.id}:`, err);
    db('scan_runs').where({ id: scanRun.id }).update({
      status: 'failed',
      error: err.message,
      completed_at: new Date().toISOString(),
    });
  });

  // Update last scan time
  await db('targets').where({ id: target.id }).update({
    last_scan_at: new Date().toISOString(),
  });
}

export async function scheduleNextScan(targetId: string): Promise<void> {
  const target = await db('targets').where({ id: targetId }).first();
  if (!target) return;

  const intervals: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  const nextScan = new Date(Date.now() + (intervals[target.schedule] || intervals.weekly));

  await db('targets').where({ id: targetId }).update({
    next_scan_at: nextScan.toISOString(),
  });
}
```

---

## Files Summary

```
scout-engine/
  src/
    db/
      migrations/
        001-engine-core.sql                    CREATE (5 tables + indexes)
    tools/
      registry.ts                              CREATE (25 tool definitions)
      runner.ts                                CREATE (tool execution with timeout, rate limiting)
    engine/
      scan-runner.ts                           CREATE (scan orchestration)
      finding-processor.ts                     CREATE (parse tool output → finding records)
      scheduler.ts                             CREATE (cron-based scan scheduling)
      deduplicator.ts                          CREATE (fingerprint-based dedup)
    api/
      targets.ts                               CREATE (CRUD for targets)
      scans.ts                                 CREATE (trigger scan, list history)
      findings.ts                              CREATE (query findings)
```

---

## Done-When Criteria

- [ ] `POST /api/v1/targets` registers a domain for scanning
- [ ] Scheduler picks up targets and triggers scans on schedule
- [ ] All 25 tools execute successfully against a test target
- [ ] Findings are parsed from tool output and stored with correct severity/type
- [ ] Duplicate findings are deduplicated (same host + port + finding type → increment seen_count)
- [ ] Scan runs are tracked with duration, tool counts, and finding counts
- [ ] Failed tools are logged with error messages, don't block other tools
- [ ] Rate limiting prevents hammering targets (tool-level delays, max concurrent)
- [ ] `GET /api/v1/findings?workspace_id=X` returns paginated findings
- [ ] `GET /api/v1/scans?target_id=X` returns scan history
- [ ] All TypeScript compiles with zero errors
- [ ] Test target "scanme.nmap.org" produces real findings
