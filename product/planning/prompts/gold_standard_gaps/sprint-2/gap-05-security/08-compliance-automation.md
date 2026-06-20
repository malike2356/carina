# Security 08; Compliance Automation (SOC2, ISO27001, GDPR)

**Source:** NEW (No agent has this. Enterprise differentiator.)
**Effort:** 4 weeks

---

## SPECIFICATION

Automated evidence collection for SOC 2, ISO 27001, and GDPR compliance. Carina should generate audit-ready compliance reports with one command.

### Framework Coverage

```
SOC 2 (Trust Services Criteria):
  Security, Availability, Confidentiality, Processing Integrity, Privacy

ISO 27001 (Information Security Management):
  Annex A controls: A.5-A.18 (114 controls)

GDPR (General Data Protection Regulation):
  Data processing registry, DPIAs, breach notification, data subject requests
```

### Implementation

```typescript
// security/compliance/collector.ts

interface ComplianceEvidence {
  framework: 'soc2' | 'iso27001' | 'gdpr';
  controlId: string;
  controlName: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  evidence: EvidenceItem[];
  lastCollected: number;
  nextCollection: number;
}

interface EvidenceItem {
  type: 'config' | 'log' | 'policy' | 'procedure' | 'screenshot' | 'attestation';
  description: string;
  source: string; // where the evidence comes from
  value: unknown; // the actual evidence
  collectedAt: number;
  expiresAt: number;
}

class ComplianceCollector {
  /**
   * Collect evidence for all controls in a framework.
   */
  async collect(framework: ComplianceFramework): Promise<ComplianceReport> {
    const controls = this.getControls(framework);
    const evidence: ComplianceEvidence[] = [];

    for (const control of controls) {
      const items = await this.collectEvidence(framework, control);
      evidence.push({
        framework: framework.id,
        controlId: control.id,
        controlName: control.name,
        status: this.assessStatus(items),
        evidence: items,
        lastCollected: Date.now(),
        nextCollection: Date.now() + 30 * 24 * 3600000, // 30 days
      });
    }

    return {
      framework,
      evidence,
      generatedAt: new Date().toISOString(),
      overallStatus: this.computeOverallStatus(evidence),
      gapAnalysis: this.generateGapAnalysis(evidence),
    };
  }

  /**
   * Auto-collect evidence from Carina's own systems.
   */
  private async autoCollect(control: ComplianceControl): Promise<EvidenceItem[]> {
    const items: EvidenceItem[] = [];

    // Examples of auto-collectable evidence:
    switch (control.id) {
      case 'soc2-cc6.1':  // Logical access controls
        items.push({
          type: 'config',
          description: 'RBAC configuration',
          source: 'security/tool-rbac.ts',
          value: await getRBACConfig(),
          collectedAt: Date.now(),
          expiresAt: Date.now() + 90 * 24 * 3600000,
        });
        break;

      case 'iso-a.12.4':  // Event logging
        items.push({
          type: 'log',
          description: 'Audit log configuration and sample',
          source: 'telemetry/',
          value: await getAuditLogConfig(),
          collectedAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 3600000,
        });
        break;

      case 'gdpr-art30':  // Records of processing activities
        items.push({
          type: 'policy',
          description: 'Data processing registry',
          source: 'compliance/data-registry.json',
          value: await getDataProcessingRegistry(),
          collectedAt: Date.now(),
          expiresAt: Date.now() + 180 * 24 * 3600000,
        });
        break;
    }

    return items;
  }
}

/**
 * GDPR-specific: Data Subject Access Request (DSAR) automation.
 */
async function handleDSAR(userId: string, requestType: 'access' | 'delete' | 'portability'): Promise<void> {
  switch (requestType) {
    case 'access':
      // Collect all data about this user
      const data = await collectUserData(userId);
      // Generate report
      await generateDSARReport(userId, data);
      break;
    case 'delete':
      // Right to be forgotten
      await deleteUserData(userId);
      // Verify deletion
      await verifyDeletion(userId);
      break;
    case 'portability':
      // Export in machine-readable format
      const portable = await collectUserData(userId);
      await exportPortableData(userId, portable);
      break;
  }
}

/**
 * GDPR breach notification automation.
 */
async function handleBreachNotification(incident: ForensicIncident): Promise<void> {
  // Check if personal data was involved
  if (!incident.involvesPersonalData) return;

  // Determine if notification is required (72-hour rule)
  const hoursSinceDetection = (Date.now() - incident.detectedAt) / 3600000;
  const requiresNotification = incident.severity === 'high' || incident.severity === 'critical';

  if (requiresNotification && hoursSinceDetection < 72) {
    // Generate breach notification
    const notification = await generateBreachNotification(incident);
    
    // Log for supervisory authority
    await logToSupervisoryAuthority(notification);
    
    // Notify affected data subjects
    if (incident.affectsDataSubjects) {
      await notifyDataSubjects(incident, notification);
    }
  }
}
```

### Compliance Dashboard

```
┌────────────────────────────────────────────────────────────┐
│  COMPLIANCE DASHBOARD                                      │
│                                                            │
│  Overall Status:  COMPLIANT (92% controls pass)         │
│                                                            │
│  SOC 2        ████████████████████░  94% (61/65)           │
│  ISO 27001    ██████████████████░░░  88% (101/114)         │
│  GDPR         █████████████████████  100% (18/18)          │
│                                                            │
│  ┌─ Gaps ─────────────────────────────────────────────┐    │
│  │  WARNING:   A.12.6.1; Vulnerability management           │    │
│  │      Last penetration test: 45 days ago (30d max)   │    │
│  │      [ Run penetration test ]                       │    │
│  │                                                     │    │
│  │  WARNING:   CC7.1; Change management                      │    │
│  │      3 PRs merged without security review           │    │
│  │      [ Review PRs ]                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                            │
│  Last evidence collection: 2 hours ago                     │
│  Next scheduled: 2026-06-18                                │
│  [ Collect Now ]  [ Export Report ]  [ Schedule Audit ]    │
└────────────────────────────────────────────────────────────┘
```

### CLI Commands

```
carina compliance status; overall compliance status
carina compliance collect --framework soc2; collect SOC 2 evidence
carina compliance collect --framework iso; collect ISO 27001 evidence
carina compliance collect --framework gdpr; collect GDPR evidence
carina compliance report --framework all; generate compliance report
carina compliance gaps; show compliance gaps
carina compliance dsar <userId> --type access; handle DSAR
carina compliance breach <incidentId>; generate breach notification
```

### Enterprise SSO Integration

```typescript
// security/compliance/sso.ts
// SAML 2.0, OpenID Connect, LDAP
// Integrate with: Okta, Azure AD, Google Workspace, OneLogin, Auth0
// Attribute-based access control (ABAC)
// Just-in-time provisioning
// SCIM for user lifecycle management

interface SSOProvider {
  type: 'saml' | 'oidc' | 'ldap';
  name: string;
  config: SSOConfig;
  mappings: AttributeMapping[];
}
```
