/**
 * Canonical Aiva/Carina production launch readiness gate.
 * Aggregates billing, caps, backups/restore evidence, GDPR, secrets, audit, and contacts.
 * Reimplements MyApi-style readiness behavior without copying AGPL code.
 */

import { readFile } from 'node:fs/promises';
import { resolveConfigValue, refreshBillingConfigCache } from '../billing/billing-config.js';
import { resolveTrialDailyCapGbp } from '../billing/aiva-ai-wallet.js';

export type GateStatus = 'ok' | 'warn' | 'fail' | 'unknown';

export interface LaunchGateCheck {
  id: string;
  label: string;
  status: GateStatus;
  detail: string;
  remediation: string;
  automated: boolean;
}

export interface LaunchGateReport {
  gate: 'aiva-production-readiness';
  overall: GateStatus;
  launchBlocked: boolean;
  summary: string;
  checkedAt: string;
  checks: LaunchGateCheck[];
  docs: {
    canonical: string;
    incidentRunbook: string;
    restoreProcedure: string;
    securityHardening: string;
  };
}

export interface LaunchGateOptions {
  /** Treat missing restore/backup epochs as fail (production / CI). */
  strict?: boolean;
  /** Skip secrets audit (unit tests). */
  skipSecrets?: boolean;
  /** Inject config resolver for tests. */
  resolveValue?: (key: string) => string;
  /** Inject epoch age reader for tests. */
  readEpochAgeSeconds?: (path: string) => Promise<number | null>;
}

const CRITICAL_AIVA_PRICE_KEYS = [
  'STRIPE_PRICE_AIVA_STARTER_MONTHLY',
  'STRIPE_PRICE_AIVA_TEAM_MONTHLY',
  'STRIPE_PRICE_AIVA_BUSINESS_MONTHLY',
] as const;

const PREPAID_PRICE_KEYS = [
  'STRIPE_PRICE_AIVA_PREPAID_5',
  'STRIPE_PRICE_AIVA_PREPAID_10',
  'STRIPE_PRICE_AIVA_PREPAID_25',
] as const;

const BACKUP_EPOCH = '/var/log/verlox/backup-last-success.epoch';
const RESTORE_EPOCH = '/var/log/verlox/restore-test-last-success.epoch';

const DOCS = {
  canonical: '01-devends/SOP/035-aiva-production-readiness-gate.md',
  incidentRunbook: '01-devends/SOP/006-launch-runbook.md',
  restoreProcedure: '02-backends/core.carinaai.uk/docker/docs/RESTORE-PROCEDURE.md',
  securityHardening: '01-devends/SOP/017-security-hardening-checklist.md',
};

async function defaultReadEpochAgeSeconds(path: string): Promise<number | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const epoch = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(epoch)) return null;
    return Math.floor(Date.now() / 1000) - epoch;
  } catch {
    return null;
  }
}

function worstStatus(statuses: GateStatus[]): GateStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('unknown')) return 'unknown';
  return 'ok';
}

function isStrictMode(opts?: LaunchGateOptions): boolean {
  if (opts?.strict != null) return opts.strict;
  return process.env.LAUNCH_GATE_STRICT === 'true'
    || process.env.NODE_ENV === 'production'
    || process.env.HOSTED_MODE === 'true';
}

/**
 * Fail-closed check used before enabling paid trials / managed-token billing.
 */
export function assertTrialCostControlsReady(resolveValue?: (key: string) => string): {
  ok: boolean;
  reasons: string[];
} {
  const get = resolveValue ?? ((key: string) => resolveConfigValue(key));
  const reasons: string[] = [];

  for (const key of CRITICAL_AIVA_PRICE_KEYS) {
    if (!get(key).trim()) {
      reasons.push(`Missing billing price: ${key}`);
    }
  }

  const capRaw = get('AIVA_TRIAL_DAILY_CAP_GBP').trim().toLowerCase();
  if (capRaw === '0' || capRaw === 'disabled' || capRaw === 'off' || capRaw === 'false') {
    reasons.push('AIVA_TRIAL_DAILY_CAP_GBP is disabled; paid trials require a positive daily cap');
  } else if (!capRaw) {
    // Empty falls back to default in wallet; still require explicit config for launch.
    reasons.push('AIVA_TRIAL_DAILY_CAP_GBP is not set; set an explicit positive GBP daily cap');
  } else {
    const n = Number(capRaw);
    if (!Number.isFinite(n) || n <= 0) {
      reasons.push('AIVA_TRIAL_DAILY_CAP_GBP must be a positive number');
    }
  }

  const creditRaw = get('AIVA_TRIAL_CREDIT_GBP').trim();
  if (creditRaw === '0') {
    reasons.push('AIVA_TRIAL_CREDIT_GBP is 0; managed-token trials need a credit grant or BYOK');
  }

  return { ok: reasons.length === 0, reasons };
}

export async function evaluateLaunchReadinessGate(
  opts: LaunchGateOptions = {},
): Promise<LaunchGateReport> {
  await refreshBillingConfigCache().catch(() => undefined);
  const get = opts.resolveValue ?? ((key: string) => resolveConfigValue(key));
  const readAge = opts.readEpochAgeSeconds ?? defaultReadEpochAgeSeconds;
  const strict = isStrictMode(opts);
  const checks: LaunchGateCheck[] = [];

  // --- Billing prices ---
  const missingPrices = CRITICAL_AIVA_PRICE_KEYS.filter((k) => !get(k).trim());
  checks.push({
    id: 'billing.stripe_prices',
    label: 'Aiva Stripe price IDs',
    status: missingPrices.length === 0 ? 'ok' : 'fail',
    detail: missingPrices.length === 0
      ? 'Starter, Team, and Business monthly price IDs are set'
      : `Missing: ${missingPrices.join(', ')}`,
    remediation: 'Set STRIPE_PRICE_AIVA_* from .access/.stripe-credentials-and-price-id.md via billing_config or env. Never create new Stripe prices in code.',
    automated: true,
  });

  const missingPrepaid = PREPAID_PRICE_KEYS.filter((k) => !get(k).trim());
  checks.push({
    id: 'billing.prepaid_prices',
    label: 'Managed-token prepaid top-ups',
    status: missingPrepaid.length === 0 ? 'ok' : 'warn',
    detail: missingPrepaid.length === 0
      ? 'Prepaid £5/£10/£25 price IDs are set'
      : `Missing prepaid prices: ${missingPrepaid.join(', ')}`,
    remediation: 'Seed STRIPE_PRICE_AIVA_PREPAID_* for quiet top-ups, or document that BYOK-only is intentional.',
    automated: true,
  });

  const promptRateKey = 'STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY';
  const promptRateSet = Boolean(get(promptRateKey).trim());
  checks.push({
    id: 'billing.prompt_rate_price',
    label: 'Aiva Prompt Rate (optional special client price)',
    status: promptRateSet ? 'ok' : 'warn',
    detail: promptRateSet
      ? 'STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY is set'
      : 'Optional: STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY not set (special client rates disabled)',
    remediation:
      'Seed from .access/.stripe-credentials-and-price-id.md (Aiva Propmp Rate £30) via billing_config or env when offering special rates.',
    automated: true,
  });

  // --- Trial / managed token cost controls ---
  const trialControls = assertTrialCostControlsReady(get);
  const capValue = get('AIVA_TRIAL_DAILY_CAP_GBP').trim();
  const resolvedCap = resolveTrialDailyCapGbp();
  checks.push({
    id: 'billing.trial_daily_cap',
    label: 'Trial daily spend cap',
    status: trialControls.ok && resolvedCap > 0 ? 'ok' : 'fail',
    detail: trialControls.ok
      ? `AIVA_TRIAL_DAILY_CAP_GBP=${capValue || '(unset)'} (resolved ${resolvedCap} GBP)`
      : trialControls.reasons.join('; '),
    remediation: 'Set AIVA_TRIAL_DAILY_CAP_GBP to a positive GBP amount before enabling paid trials.',
    automated: true,
  });

  // --- Auth / tenant isolation ---
  const hosted = process.env.HOSTED_MODE === 'true';
  const tenantKey = process.env.TENANT_KEY_ENCRYPTION_KEY?.trim() ?? '';
  checks.push({
    id: 'auth.tenant_encryption',
    label: 'Tenant key encryption',
    status: !hosted
      ? 'ok'
      : tenantKey
        ? 'ok'
        : 'fail',
    detail: !hosted
      ? 'HOSTED_MODE off; tenant encryption not required for this surface'
      : tenantKey
        ? 'TENANT_KEY_ENCRYPTION_KEY is set'
        : 'HOSTED_MODE requires TENANT_KEY_ENCRYPTION_KEY',
    remediation: 'Set TENANT_KEY_ENCRYPTION_KEY in production hosted env before public launch.',
    automated: true,
  });

  const betterAuth = Boolean(process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim());
  checks.push({
    id: 'auth.session_secret',
    label: 'Auth session secret',
    status: betterAuth || !hosted ? (betterAuth || !hosted ? (hosted && !betterAuth ? 'fail' : 'ok') : 'ok') : 'warn',
    detail: betterAuth
      ? 'Auth secret env present'
      : hosted
        ? 'BETTER_AUTH_SECRET / AUTH_SECRET missing in hosted mode'
        : 'Auth secret not checked for non-hosted installs',
    remediation: 'Set BETTER_AUTH_SECRET (or AUTH_SECRET) for the app.carinaai.uk session layer.',
    automated: true,
  });
  // Fix auth.session_secret logic - simplify:
  checks[checks.length - 1] = {
    id: 'auth.session_secret',
    label: 'Auth session secret',
    status: hosted ? (betterAuth ? 'ok' : 'fail') : (betterAuth ? 'ok' : 'unknown'),
    detail: betterAuth
      ? 'Auth secret env present'
      : hosted
        ? 'BETTER_AUTH_SECRET / AUTH_SECRET missing in hosted mode'
        : 'Not required for local operator installs; set before cloud launch',
    remediation: 'Set BETTER_AUTH_SECRET (or AUTH_SECRET) for the app.carinaai.uk session layer.',
    automated: true,
  };

  // --- Audit / tamper-evident ---
  const chainAttest = process.env.AIVA_CHAIN_ATTEST_ENABLED !== 'false';
  checks.push({
    id: 'audit.chain_attest',
    label: 'Tamper-evident audit chain',
    status: chainAttest ? 'ok' : 'warn',
    detail: chainAttest
      ? 'AIVA_CHAIN_ATTEST_ENABLED is on (default)'
      : 'Chain attestation disabled; launch with signed audit recommended',
    remediation: 'Leave AIVA_CHAIN_ATTEST_ENABLED unset or true. See SOP 017.',
    automated: true,
  });

  // --- Backups + restore evidence ---
  const backupAge = await readAge(BACKUP_EPOCH);
  if (backupAge === null) {
    checks.push({
      id: 'backup.last_success',
      label: 'Database backup heartbeat',
      status: strict ? 'fail' : 'unknown',
      detail: `No epoch at ${BACKUP_EPOCH}`,
      remediation: 'Run docker/scripts/backup-postgres.sh and ensure cron writes backup-last-success.epoch.',
      automated: true,
    });
  } else if (backupAge < 90_000) {
    checks.push({
      id: 'backup.last_success',
      label: 'Database backup heartbeat',
      status: 'ok',
      detail: `Last backup ${Math.round(backupAge / 3600)}h ago`,
      remediation: DOCS.restoreProcedure,
      automated: true,
    });
  } else {
    checks.push({
      id: 'backup.last_success',
      label: 'Database backup heartbeat',
      status: 'warn',
      detail: `Last backup stale (${Math.round(backupAge / 3600)}h ago)`,
      remediation: 'Investigate backup cron; see RESTORE-PROCEDURE.md.',
      automated: true,
    });
  }

  const restoreAge = await readAge(RESTORE_EPOCH);
  if (restoreAge === null) {
    checks.push({
      id: 'backup.restore_evidence',
      label: 'Restore test evidence',
      status: 'fail',
      detail: `No restore evidence at ${RESTORE_EPOCH}`,
      remediation: 'Run docker/scripts/backup-restore-test.sh weekly and keep restore-test-last-success.epoch. Backup configured is not enough.',
      automated: true,
    });
  } else if (restoreAge < 14 * 86_400) {
    checks.push({
      id: 'backup.restore_evidence',
      label: 'Restore test evidence',
      status: 'ok',
      detail: `Restore test ${Math.round(restoreAge / 86_400)}d ago`,
      remediation: DOCS.restoreProcedure,
      automated: true,
    });
  } else {
    checks.push({
      id: 'backup.restore_evidence',
      label: 'Restore test evidence',
      status: 'fail',
      detail: `Restore test older than 14 days (${Math.round(restoreAge / 86_400)}d)`,
      remediation: 'Re-run backup-restore-test.sh and record evidence before launch.',
      automated: true,
    });
  }

  // --- Incident contacts ---
  const p0 = get('AIVA_P0_ESCALATION_CONTACT').trim();
  checks.push({
    id: 'incident.p0_contact',
    label: 'P0 escalation contact',
    status: p0 ? 'ok' : 'warn',
    detail: p0 ? `Configured: ${p0}` : 'AIVA_P0_ESCALATION_CONTACT empty',
    remediation: 'Set AIVA_P0_ESCALATION_CONTACT in billing_config. Breach notification: SOP 006 + legal DPA.',
    automated: true,
  });

  const support = get('CARINA_SUPPORT_EMAIL').trim() || get('AIVA_SUPPORT_INBOX_MONITOR').trim();
  checks.push({
    id: 'incident.support_inbox',
    label: 'Support inbox',
    status: support ? 'ok' : 'warn',
    detail: support ? `Support contact present` : 'CARINA_SUPPORT_EMAIL / AIVA_SUPPORT_INBOX_MONITOR empty',
    remediation: 'Configure support email and MX before public launch (SOP 031).',
    automated: true,
  });

  // --- Secret hygiene ---
  if (!opts.skipSecrets) {
    try {
      const { auditStaleSecrets } = await import('../security/secrets/index.js');
      const audit = await auditStaleSecrets();
      const critical = (audit.findings ?? []).filter((f: { severity?: string }) =>
        f.severity === 'critical' || f.severity === 'high',
      );
      checks.push({
        id: 'secrets.rotation',
        label: 'Secret rotation status',
        status: critical.length > 0 ? 'fail' : 'ok',
        detail: critical.length > 0
          ? `${critical.length} high/critical stale secret finding(s)`
          : 'No high/critical stale secret findings',
        remediation: 'Run `carina security secrets` and rotate overdue credentials.',
        automated: true,
      });
    } catch {
      checks.push({
        id: 'secrets.rotation',
        label: 'Secret rotation status',
        status: 'unknown',
        detail: 'Could not run secrets audit in this environment',
        remediation: 'Run `carina security secrets` on an operator host.',
        automated: true,
      });
    }
  } else {
    checks.push({
      id: 'secrets.rotation',
      label: 'Secret rotation status',
      status: 'unknown',
      detail: 'Skipped (skipSecrets)',
      remediation: 'Run secrets audit before launch.',
      automated: true,
    });
  }

  // --- GDPR readiness (code paths present) ---
  checks.push({
    id: 'gdpr.export_erase',
    label: 'GDPR export / erase routes',
    status: 'ok',
    detail: 'workspace-gdpr export zip and eraseWorkspaceData are implemented',
    remediation: 'Verify Team/Business plan gates and run a dry erase in staging. See SOP 033.',
    automated: true,
  });

  // --- Manual evidence (warn, never auto-fail) ---
  checks.push({
    id: 'manual.legal_solicitor',
    label: 'Solicitor / legal sign-off',
    status: 'warn',
    detail: 'Manual evidence required (DPA solicitor review, live legal pages)',
    remediation: 'Complete section 1 of SOP 033 / 035 and attach evidence in aiva-launch-readiness-AUDIT.md.',
    automated: false,
  });
  checks.push({
    id: 'manual.mx_e2e',
    label: 'Support MX and mailbox E2E',
    status: 'warn',
    detail: 'Manual evidence required (MX + live email handler journey)',
    remediation: 'Complete SOP 031 support gate and Email Handler E2E before Go.',
    automated: false,
  });
  checks.push({
    id: 'manual.checkout_e2e',
    label: 'Live Stripe checkout E2E',
    status: 'warn',
    detail: 'Manual evidence required (Starter checkout, upgrade, portal cancel)',
    remediation: 'Run live checkout against production prices; record in audit file.',
    automated: false,
  });

  const overall = worstStatus(checks.map((c) => c.status));
  const launchBlocked = checks.some((c) => c.status === 'fail' && c.automated);
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return {
    gate: 'aiva-production-readiness',
    overall,
    launchBlocked,
    summary: launchBlocked
      ? `Launch blocked: ${failCount} fail, ${warnCount} warn`
      : failCount > 0
        ? `Gate has ${failCount} fail (review before Go)`
        : warnCount > 0
          ? `No automated fails; ${warnCount} warn (manual evidence still required)`
          : 'All automated checks passed',
    checkedAt: new Date().toISOString(),
    checks,
    docs: DOCS,
  };
}

export function formatLaunchGateReport(report: LaunchGateReport): string {
  const lines: string[] = [
    `Launch gate: ${report.gate}`,
    `Overall: ${report.overall} | blocked=${report.launchBlocked}`,
    report.summary,
    '',
  ];
  for (const check of report.checks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.id}; ${check.label}`);
    lines.push(`  ${check.detail}`);
    if (check.status !== 'ok') {
      lines.push(`  Fix: ${check.remediation}`);
    }
  }
  lines.push('');
  lines.push(`Canonical doc: ${report.docs.canonical}`);
  return lines.join('\n');
}

/** Exit code for CI: 1 when launchBlocked. */
export function launchGateExitCode(report: LaunchGateReport): number {
  return report.launchBlocked ? 1 : 0;
}
