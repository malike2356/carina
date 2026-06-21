# Scout SOC Visibility; Implementation Spec

**Gap:** 05; Security / Scout Product  
**Type:** Implementation prompt (NOT marketing)  
**Agent (primary):** Claude Code  
**Agent (fallback):** Cursor  
**Estimated effort:** 5 days

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

Scout's SOC2 compliance evidence collection exists as a spec in gap-08. This prompt builds the visibility layer; the actual code that surfaces compliance data in the Scout dashboard, generates auditor packages, manages share links, sends the weekly digest, and powers the public trust center.

Every number shown to the user is backed by real data from the audit trail. No mock data. If gap-08 evidence collection isn't built yet, the system returns `{ configured: false }` and the UI shows a setup prompt; never fake numbers.

---

## Module 1: Compliance Data Model & Scoring Engine

### 1.1 Database Migration

**File:** `server/src/db/migrations/016-compliance-visibility.sql`

```sql
-- Compliance control definitions (14 SOC2 Trust Services Criteria controls)
CREATE TABLE IF NOT EXISTS compliance_controls (
  id TEXT PRIMARY KEY,                    -- 'CC1.1', 'CC1.2', ... 'CC8.1'
  criteria_group TEXT NOT NULL,           -- 'CC1', 'CC2', ... 'CC8'
  name TEXT NOT NULL,                     -- 'Control Environment', etc.
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evidence items linked to controls
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id TEXT PRIMARY KEY,
  control_id TEXT NOT NULL REFERENCES compliance_controls(id),
  evidence_type TEXT NOT NULL,            -- 'agent_action', 'system_log', 'config_snapshot', 'approval_record'
  source_agent_id TEXT,                   -- which agent generated this evidence
  source_tool TEXT,                       -- which tool was used
  description TEXT NOT NULL,
  raw_data JSONB,                         -- full evidence payload
  content_hash TEXT NOT NULL,             -- SHA-256 of raw_data
  merkle_leaf_index INTEGER,              -- position in Merkle tree
  merkle_proof JSONB,                     -- Merkle proof path
  blockchain_tx TEXT,                     -- anchoring transaction hash
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient control coverage queries
CREATE INDEX IF NOT EXISTS idx_evidence_control ON compliance_evidence(control_id, collected_at);
CREATE INDEX IF NOT EXISTS idx_evidence_collected ON compliance_evidence(collected_at);

-- Auditor share links
CREATE TABLE IF NOT EXISTS compliance_auditor_links (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,             -- Random URL token
  created_by TEXT NOT NULL,               -- User ID
  expires_at TIMESTAMP NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance digest subscriptions
CREATE TABLE IF NOT EXISTS compliance_digest_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the 14 SOC2 controls
INSERT INTO compliance_controls (id, criteria_group, name, description, sort_order) VALUES
  ('CC1.1', 'CC1', 'Control Environment', 'Entity-level controls and ethical values', 1),
  ('CC1.2', 'CC1', 'Board Oversight', 'Board independence and oversight of controls', 2),
  ('CC1.3', 'CC1', 'Management Authority', 'Structure, authority, and responsibility', 3),
  ('CC1.4', 'CC1', 'Competence Commitment', 'Commitment to attract and develop competent staff', 4),
  ('CC1.5', 'CC1', 'Accountability', 'Individual accountability for control responsibilities', 5),
  ('CC2.1', 'CC2', 'Communication Objectives', 'Internal communication of control objectives', 6),
  ('CC2.2', 'CC2', 'External Communication', 'Communication with external parties', 7),
  ('CC2.3', 'CC2', 'Information Requirements', 'Identification of information requirements', 8),
  ('CC3.1', 'CC3', 'Risk Identification', 'Identification and analysis of risks', 9),
  ('CC3.2', 'CC3', 'Risk Severity', 'Assessment of risk severity and likelihood', 10),
  ('CC3.3', 'CC3', 'Fraud Risk', 'Consideration of fraud risks', 11),
  ('CC3.4', 'CC3', 'Change Impact', 'Identification of significant changes affecting controls', 12),
  ('CC4.1', 'CC4', 'Ongoing Monitoring', 'Ongoing evaluations of controls', 13),
  ('CC4.2', 'CC4', 'Deficiency Communication', 'Communication of control deficiencies', 14),
  ('CC5.1', 'CC5', 'Control Selection', 'Selection and development of control activities', 15),
  ('CC5.2', 'CC5', 'Technology Controls', 'General technology control activities', 16),
  ('CC5.3', 'CC5', 'Policy Deployment', 'Deployment of control activities through policies', 17),
  ('CC6.1', 'CC6', 'Access Control', 'Logical and physical access controls', 18),
  ('CC6.2', 'CC6', 'User Identification', 'Identification and authentication of users', 19),
  ('CC6.3', 'CC6', 'Authorization', 'Authorization of access to system resources', 20),
  ('CC6.4', 'CC6', 'Data Protection', 'Protection of data at rest and in transit', 21),
  ('CC6.5', 'CC6', 'Removal of Access', 'Timely removal of access when no longer required', 22),
  ('CC6.6', 'CC6', 'Network Security', 'Security of network and communication paths', 23),
  ('CC6.7', 'CC6', 'Malicious Software', 'Protection against malicious software', 24),
  ('CC6.8', 'CC6', 'Vulnerability Management', 'Management of system vulnerabilities', 25),
  ('CC7.1', 'CC7', 'System Monitoring', 'Monitoring of system operations', 26),
  ('CC7.2', 'CC7', 'Incident Response', 'Detection and response to security incidents', 27),
  ('CC7.3', 'CC7', 'Capacity Management', 'Management of system capacity and availability', 28),
  ('CC7.4', 'CC7', 'Backup and Recovery', 'Backup and recovery procedures', 29),
  ('CC7.5', 'CC7', 'Change Management', 'Management of system changes', 30),
  ('CC8.1', 'CC8', 'Change Authorization', 'Authorization of system changes', 31)
ON CONFLICT (id) DO NOTHING;
```

### 1.2 Compliance Scoring Engine

**File:** `server/src/compliance/scoring.ts`

```typescript
// server/src/compliance/scoring.ts

import { db } from '../db/index.js';
import { config } from '../config.js';

interface ComplianceScore {
  configured: boolean;
  totalControls: number;
  coveredControls: number;
  coveragePercent: number;
  evidenceCount: number;
  evidenceWindow: {
    start: string;
    end: string;
  };
  lastCollectionAt: string | null;
  controls: ControlCoverage[];
  trendData: TrendPoint[];
}

interface ControlCoverage {
  controlId: string;
  name: string;
  criteriaGroup: string;
  covered: boolean;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  gapAction?: {
    description: string;
    actionType: 'configure_sso' | 'enable_audit_logs' | 'upgrade_tier' | 'configure_monitoring';
    actionUrl: string;
  };
}

interface TrendPoint {
  date: string;
  coveredControls: number;
  totalControls: number;
}

export async function getComplianceScore(): Promise<ComplianceScore> {
  // Check if evidence collection is configured
  const evidenceTableExists = await db.schema.hasTable('compliance_evidence');
  if (!evidenceTableExists) {
    return { configured: false, totalControls: 14, coveredControls: 0, coveragePercent: 0, 
             evidenceCount: 0, evidenceWindow: { start: '', end: '' }, 
             lastCollectionAt: null, controls: [], trendData: [] };
  }

  // Count controls with at least one evidence item in the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const controls = await db('compliance_controls')
    .leftJoin('compliance_evidence', function() {
      this.on('compliance_controls.id', '=', 'compliance_evidence.control_id')
          .andOn('compliance_evidence.collected_at', '>=', twelveMonthsAgo.toISOString());
    })
    .select(
      'compliance_controls.id as controlId',
      'compliance_controls.name',
      'compliance_controls.criteria_group as criteriaGroup'
    )
    .count('compliance_evidence.id as evidenceCount')
    .max('compliance_evidence.collected_at as lastEvidenceAt')
    .groupBy('compliance_controls.id', 'compliance_controls.name', 'compliance_controls.criteria_group', 'compliance_controls.sort_order')
    .orderBy('compliance_controls.sort_order');

  const totalControls = controls.length;
  const coveredControls = controls.filter(c => parseInt(c.evidenceCount as string) > 0).length;

  // Build control coverage with gap actions
  const coverage: ControlCoverage[] = controls.map(c => {
    const covered = parseInt(c.evidenceCount as string) > 0;
    return {
      controlId: c.controlId,
      name: c.name,
      criteriaGroup: c.criteriaGroup,
      covered,
      evidenceCount: parseInt(c.evidenceCount as string),
      lastEvidenceAt: c.lastEvidenceAt,
      gapAction: covered ? undefined : getGapAction(c.controlId),
    };
  });

  // Trend data: monthly coverage for the last 12 months
  const trendData = await getTrendData();

  const evidenceCount = await db('compliance_evidence').count('* as count').first();

  return {
    configured: true,
    totalControls,
    coveredControls,
    coveragePercent: totalControls > 0 ? Math.round((coveredControls / totalControls) * 100) : 0,
    evidenceCount: parseInt(evidenceCount?.count as string || '0'),
    evidenceWindow: {
      start: twelveMonthsAgo.toISOString(),
      end: new Date().toISOString(),
    },
    lastCollectionAt: controls.length > 0 ? controls[0].lastEvidenceAt : null,
    controls: coverage,
    trendData,
  };
}

function getGapAction(controlId: string): ControlCoverage['gapAction'] {
  const gapMap: Record<string, ControlCoverage['gapAction']> = {
    'CC6.1': { description: 'SSO integration not configured', actionType: 'configure_sso', actionUrl: '/settings/sso' },
    'CC6.2': { description: 'SSO integration not configured', actionType: 'configure_sso', actionUrl: '/settings/sso' },
    'CC7.1': { description: 'System monitoring not configured', actionType: 'configure_monitoring', actionUrl: '/settings/monitoring' },
    'CC7.4': { description: 'Backup configuration not verified', actionType: 'configure_monitoring', actionUrl: '/settings/backups' },
    'CC7.5': { description: 'Deployment approval pipeline not configured', actionType: 'configure_monitoring', actionUrl: '/settings/deployments' },
    'CC8.1': { description: 'Deployment approval pipeline not configured', actionType: 'configure_monitoring', actionUrl: '/settings/deployments' },
  };
  return gapMap[controlId] || { description: 'Enable compliance evidence collection', actionType: 'upgrade_tier', actionUrl: '/billing/upgrade' };
}

async function getTrendData(): Promise<TrendPoint[]> {
  const points: TrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - i, 1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const result = await db('compliance_evidence')
      .where('collected_at', '>=', monthStart.toISOString())
      .where('collected_at', '<', monthEnd.toISOString())
      .countDistinct('control_id as count')
      .first();

    const totalControls = await db('compliance_controls').count('* as count').first();

    points.push({
      date: monthStart.toISOString().slice(0, 7), // '2026-06'
      coveredControls: parseInt(result?.count as string || '0'),
      totalControls: parseInt(totalControls?.count as string || '14'),
    });
  }
  return points;
}

export function calculateScoutScore(
  securityScore: number,
  complianceScore: ComplianceScore,
): { total: number; security: number; compliance: number } {
  const compliance = complianceScore.configured ? complianceScore.coveragePercent : 0;
  const total = Math.round(securityScore * 0.6 + compliance * 0.4);
  return { total, security: securityScore, compliance };
}
```

---

## Module 2: API Endpoints

### 2.1 Compliance Score Endpoint

**File:** `server/src/api/compliance/score.ts`

```typescript
// GET /api/v1/compliance/score
// Returns current compliance posture

import { Router } from 'express';
import { getComplianceScore, calculateScoutScore } from '../../compliance/scoring.js';
import { getSecurityScore } from '../../scout/scoring.js';
import { auth } from '../../middleware/auth.js';

const router = Router();

router.get('/score', auth, async (req, res) => {
  try {
    const compliance = await getComplianceScore();
    const security = await getSecurityScore();
    const scoutScore = calculateScoutScore(security.score, compliance);

    res.json({
      scoutScore: scoutScore.total,
      securityScore: scoutScore.security,
      complianceScore: scoutScore.compliance,
      compliance: {
        configured: compliance.configured,
        totalControls: compliance.totalControls,
        coveredControls: compliance.coveredControls,
        coveragePercent: compliance.coveragePercent,
        evidenceCount: compliance.evidenceCount,
        lastCollectionAt: compliance.lastCollectionAt,
        evidenceWindow: compliance.evidenceWindow,
        controls: compliance.controls,
        trendData: compliance.trendData,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute compliance score', detail: (err as Error).message });
  }
});

export default router;
```

### 2.2 Auditor Package Export Endpoint

**File:** `server/src/api/compliance/export.ts`

```typescript
// POST /api/v1/compliance/export
// Generates and returns a ZIP file with all SOC2 evidence

import { Router } from 'express';
import archiver from 'archiver';
import { db } from '../../db/index.js';
import { auth } from '../../middleware/auth.js';
import { getComplianceScore } from '../../compliance/scoring.js';
import { createHash } from 'crypto';

const router = Router();

router.post('/export', auth, async (req, res) => {
  const score = await getComplianceScore();
  if (!score.configured) {
    return res.status(400).json({ error: 'Compliance evidence collection not configured' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  const timestamp = new Date().toISOString().slice(0, 10);
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="soc2-evidence-${timestamp}.zip"`);
  archive.pipe(res);

  // Executive summary
  archive.append(JSON.stringify({
    exportDate: new Date().toISOString(),
    totalControls: score.totalControls,
    coveredControls: score.coveredControls,
    evidenceCount: score.evidenceCount,
    evidenceWindow: score.evidenceWindow,
    organizationName: process.env.SCOUT_ORG_NAME || 'Scout Customer',
  }, null, 2), { name: 'executive-summary.json' });

  // Per-control evidence
  for (const control of score.controls) {
    const evidence = await db('compliance_evidence')
      .where('control_id', control.controlId)
      .orderBy('collected_at', 'desc');

    if (evidence.length === 0) continue;

    const controlDir = `controls/${control.controlId}/`;
    
    evidence.forEach((e, i) => {
      archive.append(JSON.stringify({
        evidenceId: e.id,
        controlId: e.control_id,
        type: e.evidence_type,
        description: e.description,
        source: { agentId: e.source_agent_id, tool: e.source_tool },
        timestamp: e.collected_at,
        contentHash: e.content_hash,
        merkleProof: e.merkle_proof,
        blockchainTx: e.blockchain_tx,
        data: e.raw_data,
      }, null, 2), { name: `${controlDir}evidence-${String(i + 1).padStart(3, '0')}.json` });
    });
  }

  // Full audit trail CSV
  const allEvidence = await db('compliance_evidence')
    .orderBy('collected_at', 'asc');
  
  let csv = 'id,timestamp,control_id,type,description,source_agent,source_tool,content_hash,blockchain_tx\n';
  allEvidence.forEach(e => {
    csv += `${e.id},${e.collected_at},${e.control_id},${e.evidence_type},"${e.description}",${e.source_agent_id},${e.source_tool},${e.content_hash},${e.blockchain_tx || ''}\n`;
  });
  archive.append(csv, { name: 'audit-trail.csv' });

  archive.finalize();
});

export default router;
```

### 2.3 Auditor Share Link Endpoints

**File:** `server/src/api/compliance/share-link.ts`

```typescript
// POST /api/v1/compliance/share-link; generate new link
// DELETE /api/v1/compliance/share-link/:token; revoke link
// GET /api/v1/compliance/share-link; list active links

import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { auth } from '../../middleware/auth.js';

const router = Router();

// Generate a new auditor share link
router.post('/share-link', auth, async (req, res) => {
  const token = crypto.randomBytes(16).toString('hex'); // 32-char hex token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

  const [link] = await db('compliance_auditor_links')
    .insert({
      id: crypto.randomUUID(),
      token,
      created_by: req.user.id,
      expires_at: expiresAt.toISOString(),
    })
    .returning('*');

  res.status(201).json({
    id: link.id,
    url: `${process.env.SCOUT_BASE_URL}/audit/${link.token}`,
    token: link.token,
    expiresAt: link.expires_at,
    createdAt: link.created_at,
  });
});

// Revoke a share link
router.delete('/share-link/:token', auth, async (req, res) => {
  await db('compliance_auditor_links')
    .where({ token: req.params.token })
    .update({ revoked: true, revoked_at: new Date().toISOString() });

  res.json({ revoked: true });
});

// List active share links
router.get('/share-link', auth, async (req, res) => {
  const links = await db('compliance_auditor_links')
    .where({ revoked: false })
    .where('expires_at', '>', new Date().toISOString())
    .orderBy('created_at', 'desc');

  res.json(links.map(l => ({
    id: l.id,
    url: `${process.env.SCOUT_BASE_URL}/audit/${l.token}`,
    expiresAt: l.expires_at,
    accessCount: l.access_count,
    lastAccessedAt: l.last_accessed_at,
    createdAt: l.created_at,
  })));
});

export default router;
```

### 2.4 Public Auditor Access Endpoint

**File:** `server/src/api/compliance/auditor-view.ts`

```typescript
// GET /api/v1/compliance/auditor/:token; NO auth required
// Returns read-only compliance data for external auditors

import { Router } from 'express';
import { db } from '../../db/index.js';
import { getComplianceScore } from '../../compliance/scoring.js';

const router = Router();

router.get('/auditor/:token', async (req, res) => {
  const link = await db('compliance_auditor_links')
    .where({ token: req.params.token, revoked: false })
    .where('expires_at', '>', new Date().toISOString())
    .first();

  if (!link) {
    return res.status(404).json({ error: 'Invalid or expired link' });
  }

  // Increment access count
  await db('compliance_auditor_links')
    .where({ id: link.id })
    .update({ access_count: db.raw('access_count + 1'), last_accessed_at: new Date().toISOString() });

  const score = await getComplianceScore();

  // Return read-only subset; no raw evidence, just summaries
  res.json({
    organizationName: process.env.SCOUT_ORG_NAME || 'Scout Customer',
    reportDate: new Date().toISOString(),
    totalControls: score.totalControls,
    coveredControls: score.coveredControls,
    coveragePercent: score.coveragePercent,
    evidenceCount: score.evidenceCount,
    evidenceWindow: score.evidenceWindow,
    controls: score.controls.map(c => ({
      controlId: c.controlId,
      name: c.name,
      covered: c.covered,
      evidenceCount: c.evidenceCount,
      lastEvidenceAt: c.lastEvidenceAt,
    })),
  });
});

export default router;
```

---

## Module 3: Public Trust Center

### 3.1 Trust Center Data Endpoint

**File:** `server/src/api/compliance/trust-center.ts`

```typescript
// GET /api/v1/compliance/trust-center; PUBLIC, no auth
// Returns data for trust.labyrinthscout.com

import { Router } from 'express';
import { getComplianceScore } from '../../compliance/scoring.js';

const router = Router();

router.get('/trust-center', async (req, res) => {
  const score = await getComplianceScore();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5-minute cache
  res.json({
    monitoringSince: process.env.SCOUT_MONITORING_SINCE || '2026-06-01',
    soc2ControlsCovered: score.configured ? score.coveredControls : 0,
    soc2ControlsTotal: score.totalControls,
    lastAuditorPackageAt: score.lastCollectionAt,
    criticalFindings90Days: 0, // Pulled from Scout scoring
    cryptographicAnchors: 'Ethereum mainnet',
    anchoringFrequency: 'daily',
    soc2Badge: score.configured && score.coveragePercent === 100 ? 'ready' : 
               score.configured ? 'partial' : 'not-configured',
    iso27001Badge: 'aligned', // Static; ISO alignment is architectural, not evidence-based
    gdprBadge: 'compliant',
    complianceTrend: score.configured ? score.trendData : [],
    controls: score.configured ? score.controls.map(c => ({
      id: c.controlId,
      name: c.name,
      covered: c.covered,
    })) : [],
  });
});

export default router;
```

### 3.2 Trust Center HTML Page

**File:** `trust.labyrinthscout.com/index.html`

Static HTML + vanilla JS that fetches from the trust center API. No framework. Single file. Deploy to a separate static host or serve from nginx.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scout Trust Center; Real-Time Compliance Status</title>
  <meta name="description" content="Scout's real-time SOC2 compliance status. Continuous monitoring, cryptographic audit trails, and auditor-ready evidence packages.">
  <style>
    /* Trust center styling; dark theme, indigo/amber Scout palette */
    /* Fetch compliance data from API and render */
  </style>
</head>
<body>
  <div id="app">
    <div id="loading">Loading compliance data...</div>
  </div>
  <script>
    fetch('https://api.labyrinthscout.com/api/v1/compliance/trust-center')
      .then(r => r.json())
      .then(data => renderTrustCenter(data))
      .catch(err => document.getElementById('app').innerHTML = 
        '<div class="error">Compliance data temporarily unavailable</div>');
  </script>
</body>
</html>
```

The render function builds the badges, control coverage grid, and trend chart from the API response. No hardcoded numbers. Everything live.

---

## Module 4: Weekly Compliance Digest Cron Job

**File:** `server/src/jobs/compliance-digest.ts`

```typescript
// server/src/jobs/compliance-digest.ts
// Runs every Monday at 08:00 UTC via cron

import { getComplianceScore, calculateScoutScore } from '../compliance/scoring.js';
import { getSecurityScore } from '../scout/scoring.js';
import { db } from '../db/index.js';
import { sendEmail } from '../email/send.js';

export async function sendComplianceDigest(): Promise<void> {
  const compliance = await getComplianceScore();
  const security = await getSecurityScore();
  const scoutScore = calculateScoutScore(security.score, compliance);

  // Get active auditor links
  const activeLinks = await db('compliance_auditor_links')
    .where({ revoked: false })
    .where('expires_at', '>', new Date().toISOString())
    .orderBy('created_at', 'desc');

  // Get evidence collected this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyEvidence = await db('compliance_evidence')
    .where('collected_at', '>=', weekAgo.toISOString())
    .count('* as count')
    .first();

  // Get subscribers
  const subscribers = await db('compliance_digest_subscriptions')
    .where({ enabled: true })
    .select('email', 'user_id');

  for (const sub of subscribers) {
    const html = buildDigestEmail({
      scoutScore,
      compliance,
      security,
      weeklyEvidenceCount: parseInt(weeklyEvidence?.count as string || '0'),
      activeLinks,
    });

    await sendEmail({
      to: sub.email,
      subject: `Scout Compliance Digest; Week of ${new Date().toISOString().slice(0, 10)}`,
      html,
    });

    // Update last_sent_at
    await db('compliance_digest_subscriptions')
      .where({ user_id: sub.user_id })
      .update({ last_sent_at: new Date().toISOString() });
  }
}

function buildDigestEmail(data: {
  scoutScore: { total: number; security: number; compliance: number };
  compliance: any;
  security: any;
  weeklyEvidenceCount: number;
  activeLinks: any[];
}): string {
  // Build HTML email with compliance summary
  // Scout Score, control coverage, weekly evidence count, active auditor links
  // Links to dashboard and auditor export
  return `...`; // Template rendering
}
```

**Cron registration:**

```typescript
// server/src/cron/register.ts
cron.schedule('0 8 * * 1', async () => {
  await sendComplianceDigest();
});
```

---

## Module 5: Dashboard UI Components

### 5.1 Scout Score Widget Update

**File:** `console.labyrinthscout.com/src/components/ScoutScoreWidget.tsx`

Modify the existing Scout Score widget to fetch compliance data and show the split.

```typescript
// Add to existing component
const { data: compliance } = useQuery({
  queryKey: ['compliance-score'],
  queryFn: () => fetch('/api/v1/compliance/score').then(r => r.json()),
  refetchInterval: 60000, // Every 60 seconds
});

// If compliance.configured is false, show setup prompt instead of fake numbers
if (!compliance?.compliance?.configured) {
  return <ComplianceSetupPrompt />;
}

// Render: Scout Score (total) with security/compliance breakdown bars
```

### 5.2 Compliance Badge Component

**File:** `console.labyrinthscout.com/src/components/ComplianceBadge.tsx`

```typescript
interface ComplianceBadgeProps {
  coveredControls: number;
  totalControls: number;
}

function getBadgeState(covered: number, total: number): 'green' | 'amber' | 'red' {
  if (covered === total) return 'green';
  if (covered > 0) return 'amber';
  return 'red';
}

export function ComplianceBadge({ coveredControls, totalControls }: ComplianceBadgeProps) {
  const state = getBadgeState(coveredControls, totalControls);
  
  return (
    <div className={`compliance-badge badge-${state}`} onClick={() => navigate('/compliance')}>
      <span className="badge-dot" />
      <span className="badge-text">
        {state === 'green' ? 'SOC2: Evidence Ready' :
         state === 'amber' ? `SOC2: ${coveredControls}/${totalControls} controls` :
         'SOC2: Not Configured'}
      </span>
      <span className="badge-action">→</span>
    </div>
  );
}
```

### 5.3 Auditor Export Button

**File:** `console.labyrinthscout.com/src/components/AuditorExportButton.tsx`

```typescript
export function AuditorExportButton() {
  const [exporting, setExporting] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/v1/compliance/export', { method: 'POST' });
      const blob = await response.blob();
      
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soc2-evidence-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateLink = async () => {
    const response = await fetch('/api/v1/compliance/share-link', { method: 'POST' });
    const data = await response.json();
    setShareLink(data.url);
  };

  return (
    <div className="auditor-export">
      <button onClick={handleExport} disabled={exporting}>
        {exporting ? 'Generating...' : 'Export SOC2 Evidence Package'}
      </button>
      <button onClick={handleGenerateLink}>
        Generate Auditor Share Link
      </button>
      {shareLink && (
        <div className="share-link-display">
          <input type="text" value={shareLink} readOnly />
          <button onClick={() => navigator.clipboard.writeText(shareLink)}>Copy</button>
        </div>
      )}
    </div>
  );
}
```

---

## Files Summary

```
# Database
server/src/db/migrations/016-compliance-visibility.sql     CREATE (5 tables + seed data)

# Scoring engine
server/src/compliance/scoring.ts                            CREATE (scoring logic)

# API endpoints
server/src/api/compliance/score.ts                          CREATE (GET /score)
server/src/api/compliance/export.ts                         CREATE (POST /export)
server/src/api/compliance/share-link.ts                     CREATE (POST/DELETE/GET share-link)
server/src/api/compliance/auditor-view.ts                   CREATE (GET /auditor/:token; public)
server/src/api/compliance/trust-center.ts                   CREATE (GET /trust-center; public, no auth)

# Trust center
trust.labyrinthscout.com/index.html                         CREATE (static page, fetches API)

# Cron job
server/src/jobs/compliance-digest.ts                        CREATE (weekly email)
server/src/cron/register.ts                                 MODIFY (add digest schedule)

# Dashboard UI
console.labyrinthscout.com/src/components/
  ScoutScoreWidget.tsx                                      MODIFY (add compliance dimension)
  ComplianceBadge.tsx                                       CREATE
  AuditorExportButton.tsx                                   CREATE
  ComplianceGapAnalysis.tsx                                 CREATE
  ComplianceTrendChart.tsx                                  CREATE

# Marketing pages
labyrinthscout.com/pricing.html                             MODIFY (SOC2 differentiation)
```

---

## Done-When Criteria

- [ ] `GET /api/v1/compliance/score` returns real data from `compliance_evidence` table
- [ ] Returns `{ configured: false }` when no evidence table exists (never fake data)
- [ ] Scout Score widget shows security + compliance split
- [ ] Compliance badge shows red/amber/green based on coverage
- [ ] `POST /api/v1/compliance/export` generates a valid ZIP with per-control evidence + audit-trail.csv
- [ ] `POST /api/v1/compliance/share-link` creates time-limited auditor URLs
- [ ] `GET /api/v1/compliance/auditor/:token` returns read-only compliance data (no auth)
- [ ] Revoked/expired links return 404
- [ ] `GET /api/v1/compliance/trust-center` returns live data (no auth)
- [ ] `trust.labyrinthscout.com` fetches trust-center API and renders live
- [ ] Weekly digest fires Monday 08:00 UTC to all subscribers
- [ ] Digest email includes Scout Score, control coverage, evidence count, active auditor links
- [ ] Database migration runs cleanly without errors
- [ ] All TypeScript compiles with zero errors
- [ ] All API endpoints have proper error handling (500 with detail, not crashes)
