import {
  auditStaleSecrets,
  buildSecretsStatusReport,
  formatSecretsStatus,
  formatStaleAudit,
  rotateProvider,
  scheduleProvider,
  secretsRotationScheduler,
  syncRegistryFromEnvironment,
} from './rotation-scheduler.js';
import type {
  RotationResult,
  SecretRotationPolicy,
  SecretsRotationAuditReport,
  SecretsStatusReport,
} from './types.js';

export function shouldBlockStaleSecretsAudit(
  report: SecretsRotationAuditReport,
  failOn: 'warn' | 'fail' = 'fail',
): boolean {
  if (failOn === 'warn') {
    return report.summary.fail > 0 || report.summary.warn > 0;
  }
  return report.summary.fail > 0;
}

export async function runSecretsRotationReview(options: {
  failOn?: 'warn' | 'fail';
} = {}): Promise<{
  status: SecretsStatusReport;
  audit: SecretsRotationAuditReport;
}> {
  const status = await buildSecretsStatusReport();
  const audit = await auditStaleSecrets();
  if (shouldBlockStaleSecretsAudit(audit, options.failOn ?? 'fail')) {
    throw new Error(formatStaleAudit(audit));
  }
  return { status, audit };
}

export {
  auditStaleSecrets,
  buildSecretsStatusReport,
  formatSecretsStatus,
  formatStaleAudit,
  rotateProvider,
  scheduleProvider,
  secretsRotationScheduler,
  syncRegistryFromEnvironment,
};
export {
  computeSchedule,
  DEFAULT_ROTATION_POLICIES,
  getPolicy,
  inferSecretType,
  loadPolicies,
  parseDuration,
  savePolicies,
} from './policies.js';
export {
  _resetSecretsRegistryForTests,
  appendRotationAudit,
  getRegistryEntry,
  listRegistryEntries,
  markRotated,
  readRotationAudit,
  upsertRegistryEntry,
} from './registry.js';
export {
  generateCredentialValue,
  rotationCredentialPool,
  sleep,
} from './credential-pool.js';
export type {
  RotationResult,
  SecretRotationPolicy,
  SecretsRotationAuditReport,
  SecretsStatusReport,
  StaleSecretFinding,
  SecretStatusRow,
  SecretType,
} from './types.js';
export type { RotateOptions } from './rotation-scheduler.js';
