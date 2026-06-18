# Prompt 06: SOC2 Type II Evidence Automation

**Gap:** 08; Enterprise Security | **Priority:** HIGH | **Build Time:** 1 week

---

## GOAL

SOC2 Type II certification requires 6-12 months of continuous evidence that controls are operating effectively. Carina must automatically map its features to SOC2 trust service criteria, collect evidence continuously, and generate auditor-ready packages; turning a 6-month manual audit process into a button click.

## SOC2 TRUST SERVICE CRITERIA MAPPING

### Security (Common Criteria)

| CC# | Control | Carina Evidence |
|-----|---------|----------------|
| CC1.1 | COSO framework | Org structure + roles from RBAC |
| CC2.1 | Information security policies | Policy engine configuration snapshot |
| CC3.1 | Risk assessment | Weekly Scout Score trend + findings |
| CC4.1 | Monitoring activities | Continuous Scout scan logs |
| CC5.1 | Control activities | Kill switch logs, quarantine events |
| CC6.1 | Logical access | SSO auth logs, RBAC assignments |
| CC6.2 | User access provisioning | JIT provisioning audit trail |
| CC6.3 | Access revocation | Session termination logs |
| CC7.1 | Vulnerability detection | Nuclei scan history |
| CC7.2 | Malware detection | YARA scan results |
| CC7.3 | Boundary protection | Zero-trust network policy violations |
| CC8.1 | Change management | Config change audit trail |
| CC9.1 | Risk mitigation | Auto-remediation actions |

### Availability

| CC# | Control | Carina Evidence |
|-----|---------|----------------|
| A1.1 | Availability monitoring | Health check logs (every 30s) |
| A1.2 | Incident response | DR failover logs + RTO metrics |
| A1.3 | Backup | Backup schedule + verification logs |

### Confidentiality

| CC# | Control | Carina Evidence |
|-----|---------|----------------|
| C1.1 | Data encryption | KMS key rotation logs |
| C1.2 | Data disposal | Secure deletion audit |

## EVIDENCE COLLECTION PIPELINE

```typescript
// src/enterprise/compliance/soc2-collector.ts

interface SOC2Control {
  id: string; // e.g., 'CC7.1'
  name: string; // 'Vulnerability Detection'
  category: 'security' | 'availability' | 'confidentiality' | 'privacy' | 'processing_integrity';
  evidenceSources: EvidenceSource[];
  collectionSchedule: 'continuous' | 'daily' | 'weekly';
  retentionPeriod: string; // '12 months'
}

interface EvidenceSource {
  type: 'audit_event' | 'scan_result' | 'config_snapshot' | 'metric' | 'log';
  query: string; // SQL query or API endpoint
  transformation: (data: any) => EvidenceDocument;
}

interface EvidenceDocument {
  id: string;
  controlId: string;
  timestamp: string;
  data: unknown;
  hash: string; // SHA-256 for integrity
  signedBy?: string; // Operator who attested
}

const SOC2_CONTROLS: SOC2Control[] = [
  {
    id: 'CC7.1',
    name: 'Vulnerability Detection',
    category: 'security',
    evidenceSources: [
      {
        type: 'scan_result',
        query: `SELECT * FROM scan_runs WHERE tool='nuclei' AND completed_at > now() - interval '7 days'`,
        transformation: (data) => ({
          description: `Weekly vulnerability scan completed`,
          findings: data.length,
          critical: data.filter((f: any) => f.severity === 'critical').length,
          high: data.filter((f: any) => f.severity === 'high').length,
        }),
      },
    ],
    collectionSchedule: 'weekly',
    retentionPeriod: '12 months',
  },
  {
    id: 'CC6.1',
    name: 'Logical Access Controls',
    category: 'security',
    evidenceSources: [
      {
        type: 'audit_event',
        query: `SELECT * FROM audit_events WHERE action->>'category' = 'auth' AND timestamp > now() - interval '1 day'`,
        transformation: (data) => ({
          logins: data.filter((e: any) => e.action.name === 'login').length,
          failed: data.filter((e: any) => e.action.name === 'login_failed').length,
          ssoLogins: data.filter((e: any) => e.actor.type === 'sso').length,
        }),
      },
    ],
    collectionSchedule: 'daily',
    retentionPeriod: '12 months',
  },
  {
    id: 'A1.1',
    name: 'Availability Monitoring',
    category: 'availability',
    evidenceSources: [
      {
        type: 'metric',
        query: `SELECT * FROM health_checks WHERE timestamp > now() - interval '24 hours'`,
        transformation: (data) => ({
          totalChecks: data.length,
          failed: data.filter((h: any) => h.status !== 'healthy').length,
          uptime: ((data.filter((h: any) => h.status === 'healthy').length / data.length) * 100).toFixed(4),
        }),
      },
    ],
    collectionSchedule: 'daily',
    retentionPeriod: '12 months',
  },
];

async function collectEvidence(control: SOC2Control): Promise<EvidenceDocument[]> {
  const docs: EvidenceDocument[] = [];
  for (const source of control.evidenceSources) {
    const rawData = await querySource(source);
    const evidence = source.transformation(rawData);
    docs.push({
      id: uuid(),
      controlId: control.id,
      timestamp: new Date().toISOString(),
      data: evidence,
      hash: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    });
  }
  return docs;
}
```

## AUDITOR PACKAGE GENERATION

```bash
$ carina compliance soc2 generate --from 2026-01-01 --to 2026-06-17

Generating SOC2 Type II evidence package...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%

Package: /tmp/carina-soc2-2026H1.zip (124MB)

Contents:
  cc1_coso_framework/          12 evidence docs
  cc2_information_policies/     6 evidence docs
  cc3_risk_assessment/         24 Scout Score reports
  cc4_monitoring/             180 daily monitoring logs
  cc5_control_activities/      45 kill switch events
  cc6_logical_access/         180 daily access logs
  cc7_vulnerability/           26 weekly scan reports
  cc8_change_management/      847 config change events
  cc9_risk_mitigation/         12 auto-remediation logs
  a1_availability/            180 daily health checks
  a2_incident_response/         2 DR test reports
  a3_backup/                  180 daily backup logs
  c1_encryption/               6 KMS rotation events
  c2_disposal/                  3 secure deletion events

  summary_report.pdf            Executive summary
  control_matrix.xlsx           Control → evidence mapping
  auditor_readme.md             How to verify this package
```

### Summary Report Template

```markdown
# SOC2 Type II Evidence Package
## Carina AI Platform
### Period: 2026-01-01 to 2026-06-17

## Executive Summary
- **Controls Tested:** 14
- **Evidence Documents:** 1,847
- **Control Effectiveness:** 99.97%
- **Exceptions:** 2 (both resolved within SLA)

## Control Effectiveness by Category
| Category | Controls | Evidence | Exceptions |
|----------|----------|----------|------------|
| Security | 9 | 1,247 | 1 |
| Availability | 3 | 362 | 0 |
| Confidentiality | 2 | 238 | 1 |

## Exceptions
1. **2026-03-15:** Backup delay (22 min vs 5 min target). Root cause: S3 throttling. Resolved: Increased request rate. No data loss.
2. **2026-05-02:** Failed login spike (47 in 1 hour). Root cause: Expired SSO certificate. Resolved: Auto-renewed within SLA.

## Attestation
This evidence package was automatically generated by Carina Compliance Engine v1.2.0.
All evidence documents are cryptographically hashed (SHA-256) and stored immutably.
Verification: carina compliance verify /tmp/carina-soc2-2026H1.zip
```

## VERIFICATION

```bash
# Generate package
carina compliance soc2 generate --from 2026-01-01 --to 2026-06-17

# Verify integrity
carina compliance verify /tmp/carina-soc2-2026H1.zip
  → All 1,847 hashes verified Done: 

# Test with auditor mock
carina compliance soc2 test
  → Simulates auditor review of random evidence samples
```

## PITFALLS

1. **Evidence gaps**; If a scanner was down for 3 days, there's a gap. Detect and flag proactively.
2. **Auditor tooling**; Some auditors use proprietary tools. Export in their format (usually Excel + PDF).
3. **Control scope**; Don't claim SOC2 for the customer's infrastructure. Only Carina's platform.
4. **Renewal timing**; SOC2 Type II takes 6-12 months. Start evidence collection on day 1.
5. **False evidence**; Automated collection is great, but a human must review exceptions. Don't auto-attest.
