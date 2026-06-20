import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import { auditSecrets, type SecretsAuditReport } from './secrets-audit.js';
import { reloadEnvFromFile } from './secrets-reload.js';

function envFilePath(): string {
  return path.join(resolveCarinaHome(), '.env');
}

const plansRoot = (): string => path.join(resolveCarinaHome(), 'secrets-plans');
const snapshotsRoot = (): string => path.join(resolveCarinaHome(), 'secrets-snapshots');

export type SecretsPlanAction =
  | { type: 'set'; key: string; value: string }
  | { type: 'unset'; key: string }
  | { type: 'chmod'; mode: number };

export type SecretsPlan = {
  id: string;
  createdAt: string;
  description: string;
  actions: SecretsPlanAction[];
  snapshotPath: string;
};

export type SecretsPlanApplyResult = {
  applied: string[];
  skipped: string[];
  planId: string;
};

function ensureDirs(): void {
  fs.mkdirSync(plansRoot(), { recursive: true, mode: 0o700 });
  fs.mkdirSync(snapshotsRoot(), { recursive: true, mode: 0o700 });
}

function parseEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function serializeEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
    .concat('\n');
}

export function snapshotEnv(envPath = envFilePath()): string {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(snapshotsRoot(), `env-${stamp}.bak`);
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, snapshotPath);
    fs.chmodSync(snapshotPath, 0o600);
  } else {
    fs.writeFileSync(snapshotPath, '', { mode: 0o600 });
  }
  return snapshotPath;
}

export function buildSecretsPlanFromAudit(
  report: SecretsAuditReport,
  description = 'auto plan from audit',
): SecretsPlan {
  ensureDirs();
  const actions: SecretsPlanAction[] = [];
  for (const finding of report.findings) {
    if (finding.severity === 'ok' || finding.source !== 'env-file') continue;
    if (finding.key === '.env') continue;
    actions.push({ type: 'unset', key: finding.key });
  }
  if (fs.existsSync(envFilePath())) {
    const mode = fs.statSync(envFilePath()).mode & 0o777;
    if (mode > 0o600) {
      actions.push({ type: 'chmod', mode: 0o600 });
    }
  }
  const snapshotPath = snapshotEnv();
  const plan: SecretsPlan = {
    id: `plan_${crypto.randomBytes(8).toString('hex')}`,
    createdAt: new Date().toISOString(),
    description,
    actions,
    snapshotPath,
  };
  fs.writeFileSync(path.join(plansRoot(), `${plan.id}.json`), JSON.stringify(plan, null, 2), { mode: 0o600 });
  return plan;
}

export function loadSecretsPlan(planId: string): SecretsPlan | null {
  const file = path.join(plansRoot(), `${planId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as SecretsPlan;
  } catch {
    return null;
  }
}

export function listSecretsPlans(): SecretsPlan[] {
  ensureDirs();
  return fs.readdirSync(plansRoot())
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(plansRoot(), f), 'utf-8')) as SecretsPlan;
      } catch {
        return null;
      }
    })
    .filter((p): p is SecretsPlan => p !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function applySecretsPlan(planId: string): SecretsPlanApplyResult {
  const plan = loadSecretsPlan(planId);
  if (!plan) throw new Error(`plan not found: ${planId}`);

  const applied: string[] = [];
  const skipped: string[] = [];
  const env = parseEnvFile(envFilePath());

  for (const action of plan.actions) {
    if (action.type === 'set') {
      env[action.key] = action.value;
      applied.push(`set ${action.key}`);
      continue;
    }
    if (action.type === 'unset') {
      if (env[action.key] !== undefined) {
        delete env[action.key];
        applied.push(`unset ${action.key}`);
      } else {
        skipped.push(`unset ${action.key} (missing)`);
      }
      continue;
    }
    if (action.type === 'chmod') {
      const file = envFilePath();
      if (fs.existsSync(file)) {
        fs.chmodSync(file, action.mode);
        applied.push(`chmod ${action.mode.toString(8)}`);
      }
    }
  }

  const file = envFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeEnv(env), { mode: 0o600 });
  reloadEnvFromFile(file, true);
  return { applied, skipped, planId };
}

export function rollbackSecretsPlan(planId: string): SecretsPlanApplyResult {
  const plan = loadSecretsPlan(planId);
  if (!plan) throw new Error(`plan not found: ${planId}`);
  if (!fs.existsSync(plan.snapshotPath)) {
    throw new Error(`snapshot missing: ${plan.snapshotPath}`);
  }
  fs.copyFileSync(plan.snapshotPath, envFilePath());
  fs.chmodSync(envFilePath(), 0o600);
  reloadEnvFromFile(envFilePath(), true);
  return {
    applied: [`restored snapshot ${plan.snapshotPath}`],
    skipped: [],
    planId,
  };
}

export function planFromCurrentAudit(): SecretsPlan {
  const report = auditSecrets({ includeProcessEnv: true });
  return buildSecretsPlanFromAudit(report);
}
