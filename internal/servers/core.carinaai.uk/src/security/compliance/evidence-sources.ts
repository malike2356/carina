import fs from 'node:fs/promises';
import path from 'node:path';
import {
  listRoleToolLimits,
  minRoleForToolTier,
} from '../tool-rbac.js';
import { readSecurityAuditTail } from '../security-audit.js';
import { loadScenarios, resolveScenariosDir } from '../penetration/loader.js';
import { getDataProcessingRegistryEvidence } from './data-registry.js';
import { lastCollectionPath } from './paths.js';
import type { EvidenceItem } from './types.js';

const DAY_MS = 86_400_000;

export type EvidenceCollectorResult = {
  items: EvidenceItem[];
  compliant: boolean;
  detail?: string;
};

function attestation(
  description: string,
  source: string,
  value: unknown,
  compliant: boolean,
  ttlDays: number,
  now = Date.now(),
): EvidenceCollectorResult {
  return {
    compliant,
    items: [{
      type: 'attestation',
      description,
      source,
      value,
      collectedAt: now,
      expiresAt: now + ttlDays * DAY_MS,
    }],
  };
}

export async function collectRbacConfig(now = Date.now()): Promise<EvidenceCollectorResult> {
  const roles = ['viewer', 'auditor', 'operator', 'admin', 'owner'] as const;
  const value = {
    roleLimits: Object.fromEntries(roles.map((role) => [role, listRoleToolLimits(role)])),
    sampleMinimumRoles: {
      shellExec: minRoleForToolTier('critical'),
      fileRead: minRoleForToolTier('low'),
    },
  };
  return {
    compliant: true,
    items: [{
      type: 'config',
      description: 'RBAC configuration',
      source: 'security/tool-rbac.ts',
      value,
      collectedAt: now,
      expiresAt: now + 90 * DAY_MS,
    }],
  };
}

export async function collectAuditLogSample(now = Date.now()): Promise<EvidenceCollectorResult> {
  const sample = readSecurityAuditTail(25);
  const value = {
    auditFileConfigured: true,
    sampleSize: sample.length,
    categories: [...new Set(sample.map((row) => row.category))],
    recent: sample.slice(-5).map((row) => ({
      at: row.at,
      category: row.category,
      action: row.action,
    })),
  };
  return {
    compliant: sample.length > 0 || process.env.CARINA_SECURITY_AUDIT !== 'false',
    detail: sample.length === 0 ? 'No audit events recorded yet' : undefined,
    items: [{
      type: 'log',
      description: 'Audit log configuration and sample',
      source: 'security/security-audit.ts',
      value,
      collectedAt: now,
      expiresAt: now + 30 * DAY_MS,
    }],
  };
}

export async function collectDataProcessingRegistry(now = Date.now()): Promise<EvidenceCollectorResult> {
  const item = await getDataProcessingRegistryEvidence(now);
  const registry = item.value as { activities?: unknown[] };
  return {
    compliant: Array.isArray(registry.activities) && registry.activities.length > 0,
    items: [item],
  };
}

export async function collectSecretsRotationStatus(now = Date.now()): Promise<EvidenceCollectorResult> {
  const { buildSecretsStatusReport } = await import('../secrets/rotation-scheduler.js');
  const status = await buildSecretsStatusReport();
  const staleCount = status.rows.filter((row) => row.stale).length;
  return {
    compliant: staleCount === 0,
    detail: staleCount > 0 ? `${staleCount} stale credential(s)` : undefined,
    items: [{
      type: 'config',
      description: 'Credential rotation status',
      source: 'security/secrets/rotation-scheduler.ts',
      value: status,
      collectedAt: now,
      expiresAt: now + 30 * DAY_MS,
    }],
  };
}

export async function collectSupplyChainStatus(now = Date.now()): Promise<EvidenceCollectorResult> {
  const { resolveProjectRoot, scanDependencies } = await import('../supply-chain/index.js');
  const report = await scanDependencies(resolveProjectRoot());
  const compliant = report.verdict !== 'blocked';
  return {
    compliant,
    detail: report.verdict === 'blocked' ? 'Dependency scan blocked' : undefined,
    items: [{
      type: 'config',
      description: 'Supply chain dependency scan',
      source: 'security/supply-chain/dependency-scan.ts',
      value: {
        verdict: report.verdict,
        summary: report.summary,
        findingCount: report.findings.length,
      },
      collectedAt: now,
      expiresAt: now + 14 * DAY_MS,
    }],
  };
}

export async function collectPentestPosture(now = Date.now()): Promise<EvidenceCollectorResult> {
  const dir = resolveScenariosDir();
  const scenarios = loadScenarios(dir);
  let lastRunAt: number | undefined;
  try {
    const meta = JSON.parse(await fs.readFile(lastCollectionPath(), 'utf8')) as {
      pentestLastRunAt?: number;
    };
    lastRunAt = meta.pentestLastRunAt;
  } catch {
    // ignore
  }
  const maxAgeMs = 30 * DAY_MS;
  const ageMs = lastRunAt ? now - lastRunAt : Number.POSITIVE_INFINITY;
  const compliant = scenarios.length > 0 && ageMs <= maxAgeMs;
  return {
    compliant,
    detail: !lastRunAt
      ? 'No penetration test run recorded'
      : ageMs > maxAgeMs
        ? `Last penetration test ${Math.round(ageMs / DAY_MS)} days ago (30d max)`
        : undefined,
    items: [{
      type: 'procedure',
      description: 'Penetration test scenario coverage',
      source: path.join(dir, '*.yaml'),
      value: {
        scenarioCount: scenarios.length,
        lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
        maxAgeDays: 30,
        compliant,
      },
      collectedAt: now,
      expiresAt: now + 30 * DAY_MS,
    }],
  };
}

export async function collectSecurityReviewPosture(now = Date.now()): Promise<EvidenceCollectorResult> {
  const { resolveRepoRoot, collectReviewTargets } = await import('../automated-review/git-changes.js');
  const repoRoot = resolveRepoRoot();
  const targets = collectReviewTargets(repoRoot, { paths: undefined });
  const value = {
    reviewTargetsAvailable: targets.length,
    automatedReviewEnabled: true,
    note: 'Run carina security review on changed paths before merge',
  };
  return attestation(
    'Automated security review availability',
    'security/automated-review/review-bot.ts',
    value,
    true,
    30,
    now,
  );
}

export async function collectTrustComplianceSnapshot(now = Date.now()): Promise<EvidenceCollectorResult> {
  const { buildTrustComplianceReport } = await import('../trust-compliance-report.js');
  const report = await buildTrustComplianceReport();
  const compliant = report.totals.postureFail === 0;
  return {
    compliant,
    detail: compliant ? undefined : `${report.totals.postureFail} posture check(s) failed`,
    items: [{
      type: 'policy',
      description: 'Trust and compliance posture snapshot',
      source: 'security/trust-compliance-report.ts',
      value: {
        totals: report.totals,
        executiveSummary: report.executiveSummary,
        recommendationCount: report.recommendations.length,
      },
      collectedAt: now,
      expiresAt: now + 30 * DAY_MS,
    }],
  };
}

export async function collectForensicsPipeline(now = Date.now()): Promise<EvidenceCollectorResult> {
  const { forensicsEngine } = await import('../forensics/engine.js');
  const incidents = await forensicsEngine.listIncidents(5);
  const playbooks = forensicsEngine.listPlaybooks();
  const value = {
    incidentCount: incidents.length,
    playbookCount: playbooks.length,
    pipelineReady: playbooks.length >= 5,
  };
  return attestation(
    'Forensics pipeline readiness',
    'security/forensics/engine.ts',
    value,
    value.pipelineReady,
    90,
    now,
  );
}

export async function collectEncryptionConfig(now = Date.now()): Promise<EvidenceCollectorResult> {
  const value = {
    nodeTlsMinVersion: process.env.NODE_OPTIONS?.includes('tls-min-v1.2') ? 'configured' : 'default',
    httpsOnlyRecommended: Boolean(process.env.CARINA_GATEWAY_HTTPS_ONLY ?? process.env.HTTPS),
    secretsFileMode: '0600',
    redactionEnabled: true,
  };
  return attestation(
    'Encryption and transport configuration',
    'security/redaction.ts',
    value,
    true,
    90,
    now,
  );
}

export async function collectDsarCapability(now = Date.now()): Promise<EvidenceCollectorResult> {
  const value = {
    handlers: ['access', 'delete', 'portability'],
    cli: 'carina compliance dsar <userId> --type access|delete|portability',
    exportFormat: 'json',
  };
  return attestation(
    'DSAR automation capability',
    'security/compliance/dsar.ts',
    value,
    true,
    180,
    now,
  );
}

export async function collectBreachNotificationCapability(now = Date.now()): Promise<EvidenceCollectorResult> {
  const value = {
    handlers: ['generateBreachNotification', 'logToSupervisoryAuthority', 'notifyDataSubjects'],
    cli: 'carina compliance breach <incidentId>',
    notificationWindowHours: 72,
  };
  return attestation(
    'GDPR breach notification automation',
    'security/compliance/breach.ts',
    value,
    true,
    180,
    now,
  );
}

const COLLECTORS: Record<string, (now?: number) => Promise<EvidenceCollectorResult>> = {
  rbac_config: collectRbacConfig,
  audit_log_sample: collectAuditLogSample,
  data_processing_registry: collectDataProcessingRegistry,
  secrets_rotation_status: collectSecretsRotationStatus,
  supply_chain_status: collectSupplyChainStatus,
  pentest_posture: collectPentestPosture,
  security_review_posture: collectSecurityReviewPosture,
  trust_compliance_snapshot: collectTrustComplianceSnapshot,
  forensics_pipeline: collectForensicsPipeline,
  encryption_config: collectEncryptionConfig,
  dsar_capability: collectDsarCapability,
  breach_notification_capability: collectBreachNotificationCapability,
};

export async function collectEvidenceForControl(
  collectorId: string,
  now = Date.now(),
): Promise<EvidenceCollectorResult> {
  const collector = COLLECTORS[collectorId];
  if (!collector) {
    return {
      compliant: false,
      detail: `Unknown collector: ${collectorId}`,
      items: [],
    };
  }
  return collector(now);
}

export async function recordPentestRunTimestamp(now = Date.now()): Promise<void> {
  const filePath = lastCollectionPath();
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    meta = {};
  }
  meta.pentestLastRunAt = now;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2), { mode: 0o600 });
}
