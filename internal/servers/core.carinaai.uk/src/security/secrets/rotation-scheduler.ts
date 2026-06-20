import { randomUUID } from 'node:crypto';
import { PROVIDER_MAP } from '../../brain/provider-registry.js';
import { appendSecurityAudit } from '../security-audit.js';
import { getCredentialPoolManager } from '../../credentials/pool-manager.js';
import {
  generateCredentialValue,
  rotationCredentialPool,
  sleep,
} from './credential-pool.js';
import {
  computeSchedule,
  getPolicy,
  loadPolicies,
  savePolicies,
  saveSchedule,
} from './policies.js';
import {
  appendRotationAudit,
  getRegistryEntry,
  markRotated,
  upsertRegistryEntry,
} from './registry.js';
import type {
  RotationResult,
  SecretRotationPolicy,
  SecretStatusRow,
  SecretsRotationAuditReport,
  SecretsStatusReport,
} from './types.js';

export type RotateOptions = {
  newValue?: string;
  dryRun?: boolean;
  rotationWindowMs?: number;
};

function nowMs(): number {
  return Date.now();
}

export class SecretsRotationScheduler {
  async schedule(policy: SecretRotationPolicy): Promise<void> {
    const policies = await loadPolicies();
    await savePolicies([...policies.filter((row) => row.provider !== policy.provider), policy]);
    const nextRunAt = nowMs() + policy.maxAgeMs;
    await saveSchedule({
      provider: policy.provider,
      nextRunAt,
      cronHint: computeSchedule(policy),
    });
    await appendRotationAudit({
      at: new Date().toISOString(),
      action: 'rotation_scheduled',
      provider: policy.provider,
      detail: computeSchedule(policy),
    });
  }

  async rotate(policy: SecretRotationPolicy, options: RotateOptions = {}): Promise<RotationResult> {
    const existing = await getRegistryEntry(policy.provider);
    const oldCredentialId = existing?.credentialId;
    const newValue = options.newValue ?? generateCredentialValue(policy);

    if (options.dryRun) {
      return {
        provider: policy.provider,
        rotated: false,
        oldCredentialId,
        newCredentialId: randomUUID(),
        message: `Dry run: would rotate ${policy.provider}`,
      };
    }

    try {
      const newCred = await rotationCredentialPool.add(policy.provider, newValue);
      await sleep(options.rotationWindowMs ?? policy.rotationWindowMs);
      await rotationCredentialPool.activate(policy.provider, newCred);

      const mgr = getCredentialPoolManager();
      const pool = mgr.describePool(policy.provider);
      const oldKey = pool.keys[0]?.redacted;
      if (oldKey && oldCredentialId) {
        await rotationCredentialPool.revoke(policy.provider, oldCredentialId, oldKey);
      }

      const expiresAt = nowMs() + policy.maxAgeMs;
      await markRotated(policy.provider, newCred.id, expiresAt);
      await upsertRegistryEntry({
        provider: policy.provider,
        secretType: policy.secretType,
        envKey: policy.envKey,
        expiresAt,
        active: true,
      });

      await appendRotationAudit({
        at: new Date().toISOString(),
        action: 'secret_rotated',
        provider: policy.provider,
        oldCredentialId,
        newCredentialId: newCred.id,
      });
      appendSecurityAudit({
        category: 'attestation',
        action: 'rotate',
        detail: `Secret rotated for provider ${policy.provider}`,
        metadata: { provider: policy.provider, oldCredentialId, newCredentialId: newCred.id },
      });

      return {
        provider: policy.provider,
        rotated: true,
        oldCredentialId,
        newCredentialId: newCred.id,
        message: `Rotated ${policy.provider} with zero-downtime pool window`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await appendRotationAudit({
        at: new Date().toISOString(),
        action: 'rotation_failed',
        provider: policy.provider,
        detail: message,
      });
      throw err;
    }
  }

  computeSchedule(policy: SecretRotationPolicy): string {
    return computeSchedule(policy);
  }
}

export const secretsRotationScheduler = new SecretsRotationScheduler();

export async function syncRegistryFromEnvironment(): Promise<void> {
  const mgr = getCredentialPoolManager();
  for (const provider of mgr.listConfiguredProviders()) {
    const def = PROVIDER_MAP[provider];
    const policy = await getPolicy(provider);
    const existing = await getRegistryEntry(provider);
    const expiresAt = (existing?.lastRotatedAt ?? nowMs()) + policy.maxAgeMs;
    await upsertRegistryEntry({
      provider,
      secretType: policy.secretType,
      envKey: def?.apiKeyEnv,
      expiresAt,
      active: true,
    });
  }
}

export async function buildSecretsStatusReport(): Promise<SecretsStatusReport> {
  await syncRegistryFromEnvironment();
  const mgr = getCredentialPoolManager();
  const rows: SecretStatusRow[] = [];

  for (const provider of mgr.listConfiguredProviders()) {
    const policy = await getPolicy(provider);
    const entry = await getRegistryEntry(provider);
    const pool = mgr.describePool(provider);
    const ageMs = entry ? nowMs() - entry.lastRotatedAt : 0;
    const expiresInMs = entry ? entry.expiresAt - nowMs() : policy.maxAgeMs;
    rows.push({
      provider,
      secretType: policy.secretType,
      envKey: policy.envKey,
      ageMs,
      expiresInMs,
      stale: ageMs > policy.maxAgeMs,
      notifyDue: expiresInMs <= policy.notifyBeforeMs,
      poolSize: pool.size,
      activeCredentialId: entry?.credentialId ?? 'unknown',
      lastRotatedAt: entry ? new Date(entry.lastRotatedAt).toISOString() : 'unknown',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    rows: rows.sort((a, b) => a.provider.localeCompare(b.provider)),
  };
}

export async function auditStaleSecrets(): Promise<SecretsRotationAuditReport> {
  const status = await buildSecretsStatusReport();
  const findings = status.rows.flatMap((row) => {
    const policyPromise = getPolicy(row.provider);
    return policyPromise.then((policy) => {
      if (!row.stale && !row.notifyDue) return [];
      const severity = row.stale ? 'fail' as const : 'warn' as const;
      return [{
        provider: row.provider,
        envKey: row.envKey,
        severity,
        ageMs: row.ageMs,
        maxAgeMs: policy.maxAgeMs,
        detail: row.stale
          ? `Credential exceeded max age (${Math.round(row.ageMs / 86_400_000)} days)`
          : `Credential rotation due within notify window (${Math.round(row.expiresInMs / 86_400_000)} days remaining)`,
      }];
    });
  });
  const resolved = (await Promise.all(findings)).flat();
  return {
    generatedAt: new Date().toISOString(),
    findings: resolved,
    summary: {
      ok: status.rows.length - resolved.length,
      warn: resolved.filter((row) => row.severity === 'warn').length,
      fail: resolved.filter((row) => row.severity === 'fail').length,
    },
  };
}

export function formatSecretsStatus(report: SecretsStatusReport): string {
  const lines = [`Secrets status (${report.rows.length} providers)`, ''];
  for (const row of report.rows) {
    lines.push(
      `  ${row.provider}: age=${Math.round(row.ageMs / 86_400_000)}d pool=${row.poolSize} stale=${row.stale} notify=${row.notifyDue}`,
    );
  }
  return lines.join('\n');
}

export function formatStaleAudit(report: SecretsRotationAuditReport): string {
  return [
    `Stale secrets audit: ${report.summary.fail} fail, ${report.summary.warn} warn, ${report.summary.ok} ok`,
    ...report.findings.map((row) => `  [${row.severity}] ${row.provider}: ${row.detail}`),
  ].join('\n');
}

export async function rotateProvider(
  provider: string,
  options: RotateOptions = {},
): Promise<RotationResult> {
  const policy = await getPolicy(provider);
  return secretsRotationScheduler.rotate(policy, options);
}

export async function scheduleProvider(
  provider: string,
  overrides: Partial<Omit<SecretRotationPolicy, 'provider'>> = {},
): Promise<void> {
  const base = await getPolicy(provider);
  await secretsRotationScheduler.schedule({ ...base, ...overrides, provider });
}