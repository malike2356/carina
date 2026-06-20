# Prompt 06: SOC2 Evidence Automation (Continuous Control Monitoring)

## Context

The compliance-automation prompt (category 06, prompt 03) built evidence packaging on demand.
This prompt builds continuous control monitoring: Carina checks SOC2 controls automatically
every week and surfaces gaps before the auditor sees them. The result is a "compliance health
score" similar to Scout's security score.

## What to Build

### 1. Control health checker

Create `src/security/compliance/control-health.ts`:
```typescript
export type ControlHealth = {
  controlId: string;
  status: 'passing' | 'warning' | 'failing';
  lastChecked: Date;
  evidence: { type: string; count: number }[];
  issues: string[];
};

export async function checkControlHealth(controlId: ControlId): Promise<ControlHealth> {
  const control = SOC2_CONTROLS[controlId];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const recentEvents = await db.query(
    `SELECT event_type, COUNT(*) as count
     FROM scout_events
     WHERE event_type = ANY($1) AND timestamp > $2
     GROUP BY event_type`,
    [control.evidenceSources, thirtyDaysAgo]
  );

  const issues: string[] = [];
  if (recentEvents.rows.length === 0) {
    issues.push(`No evidence collected for ${controlId} in the last 30 days`);
  }

  // Control-specific checks
  if (controlId === 'CC6.1') {
    const failedLogins = recentEvents.rows.find(r => r.event_type === 'auth.failed');
    if (failedLogins && Number(failedLogins.count) > 100) {
      issues.push('High number of failed login attempts (>100 in 30 days) - review access controls');
    }
  }

  const status = issues.length === 0 ? 'passing' : issues.length < 3 ? 'warning' : 'failing';
  return { controlId, status, lastChecked: new Date(), evidence: recentEvents.rows, issues };
}
```

### 2. Weekly compliance check

Create `src/agents/checks/compliance-check.ts`:
```typescript
export async function complianceCheck(): Promise<AgentCheckResult> {
  if (new Date().getUTCDay() !== 1) return { name: 'compliance', urgent: false, summary: null }; // Mondays

  const controls = Object.keys(SOC2_CONTROLS) as ControlId[];
  const results = await Promise.all(controls.map(checkControlHealth));

  const failing = results.filter(r => r.status === 'failing');
  const warnings = results.filter(r => r.status === 'warning');

  if (failing.length > 0) {
    return {
      name: 'compliance',
      urgent: true,
      summary: `SOC2 Compliance: ${failing.length} controls failing: ${failing.map(r => r.controlId).join(', ')}`,
    };
  }

  return {
    name: 'compliance',
    urgent: false,
    summary: `SOC2 Compliance: all controls passing. ${warnings.length} warnings.`,
  };
}
```

### 3. Compliance score

Compute a compliance score (0-100) from control health:
```typescript
export function computeComplianceScore(results: ControlHealth[]): number {
  const scores = results.map(r => r.status === 'passing' ? 100 : r.status === 'warning' ? 60 : 0);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
```

Show compliance score alongside Scout Score in the ops security dashboard.

### 4. Control evidence API

```
GET /api/ops/compliance/health         - all controls with current status
GET /api/ops/compliance/health/:id     - single control health
GET /api/ops/compliance/score          - compliance score (0-100)
POST /api/ops/compliance/check         - trigger immediate check
```

### 5. Remediation suggestions

When a control is failing, Carina suggests concrete remediation:
```typescript
const REMEDIATION_SUGGESTIONS: Record<ControlId, string[]> = {
  'CC6.1': [
    'Enable MFA for all user accounts',
    'Review and remove inactive user accounts',
    'Enable login failure lockout (max 5 attempts)',
  ],
  'CC7.1': [
    'Ensure Scout is connected and receiving events',
    'Configure Scout alerts for critical severity events',
    'Review and acknowledge all unresolved Scout alerts',
  ],
};
```

These appear as a "How to fix" list when the control is failing.

## Verification Checklist

- [ ] `GET /api/ops/compliance/health` returns status for all controls
- [ ] Controls with no evidence in 30 days show `failing` status
- [ ] Monday check-in includes compliance summary
- [ ] Compliance score appears in ops security dashboard
- [ ] Failing control shows remediation suggestions with specific steps

## Files to Create or Modify

- CREATE `src/security/compliance/control-health.ts`
- CREATE `src/agents/checks/compliance-check.ts`
- CREATE `src/api/compliance-health.ts`
- MODIFY `src/server.ts` - mount compliance health routes
- MODIFY `ops.carinaai.uk/views/security.ejs` - add compliance score section
- MODIFY `src/agents/checks/index.ts` - register complianceCheck
