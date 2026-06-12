import fs from 'fs';
import path from 'path';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import { reloadEnvFromFile } from './secrets-reload.js';

export type SecretFinding = {
  id: string;
  severity: 'ok' | 'warn' | 'fail';
  source: 'env-file' | 'process' | 'credentials' | 'config';
  key: string;
  detail: string;
};

export type SecretsAuditReport = {
  generatedAt: string;
  findings: SecretFinding[];
  precedenceDrift: string[];
  unresolvedRefs: string[];
  summary: { ok: number; warn: number; fail: number };
};

const SECRET_KEY_RE = /(_API_KEY|_TOKEN|_SECRET|PASSWORD|_AUTH)/i;
const PLACEHOLDER_RE = /^(<set>|your[-_]|changeme|xxx+|TODO|TBD|\*\*\*)$/i;

function parseEnvLines(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function scanUnresolvedRefs(raw: string): string[] {
  const refs: string[] = [];
  const re = /\$\{([A-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    refs.push(m[1]!);
  }
  return refs;
}

export function auditSecrets(options: {
  envPath?: string;
  includeProcessEnv?: boolean;
} = {}): SecretsAuditReport {
  const envPath = options.envPath ?? CARINA_ENV_PATH;
  const findings: SecretFinding[] = [];
  const precedenceDrift: string[] = [];
  const unresolvedRefs: string[] = [];

  let fileEnv: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    fileEnv = parseEnvLines(fs.readFileSync(envPath, 'utf-8'));
    for (const [key, value] of Object.entries(fileEnv)) {
      if (!SECRET_KEY_RE.test(key)) continue;
      const empty = !value.trim();
      const placeholder = PLACEHOLDER_RE.test(value.trim());
      findings.push({
        id: `env:${key}`,
        severity: empty || placeholder ? 'fail' : 'ok',
        source: 'env-file',
        key,
        detail: empty ? 'empty secret in .env' : placeholder ? 'placeholder value in .env' : 'set in .env',
      });
    }
  } else {
    findings.push({
      id: 'env:missing',
      severity: 'warn',
      source: 'env-file',
      key: '.env',
      detail: 'no .env file',
    });
  }

  if (options.includeProcessEnv) {
    for (const key of Object.keys(fileEnv)) {
      if (!SECRET_KEY_RE.test(key)) continue;
      const fileVal = fileEnv[key] ?? '';
      const procVal = process.env[key];
      if (procVal !== undefined && procVal !== fileVal) {
        precedenceDrift.push(`${key}: process.env overrides .env (runtime wins)`);
        findings.push({
          id: `drift:${key}`,
          severity: 'warn',
          source: 'process',
          key,
          detail: 'process.env value differs from .env file',
        });
      }
    }

    for (const key of Object.keys(process.env)) {
      if (!SECRET_KEY_RE.test(key)) continue;
      if (fileEnv[key] === undefined && process.env[key]) {
        findings.push({
          id: `proc-only:${key}`,
          severity: 'warn',
          source: 'process',
          key,
          detail: 'set in process.env but absent from .env',
        });
      }
    }
  }

  const credPath = process.env.CARINA_CREDENTIALS_FILE ?? path.join(CARINA_HOME, 'credentials.json');
  if (fs.existsSync(credPath)) {
    const raw = fs.readFileSync(credPath, 'utf-8');
    for (const ref of scanUnresolvedRefs(raw)) {
      if (!process.env[ref] && !fileEnv[ref]) {
        unresolvedRefs.push(`${ref} (referenced in credentials.json)`);
        findings.push({
          id: `cred-ref:${ref}`,
          severity: 'fail',
          source: 'credentials',
          key: ref,
          detail: 'unresolved ${VAR} reference in credentials.json',
        });
      }
    }
  }

  const configPath = path.join(CARINA_HOME, 'config.yaml');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    if (/api_key:\s*[^\s#${]/i.test(raw)) {
      findings.push({
        id: 'config:api_key-inline',
        severity: 'warn',
        source: 'config',
        key: 'providers.*.api_key',
        detail: 'plaintext api_key in config.yaml; prefer .env',
      });
    }
  }

  const summary = {
    ok: findings.filter((f) => f.severity === 'ok').length,
    warn: findings.filter((f) => f.severity === 'warn').length,
    fail: findings.filter((f) => f.severity === 'fail').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    findings,
    precedenceDrift,
    unresolvedRefs,
    summary,
  };
}

export function reloadSecretsAuditSnapshot(): SecretsAuditReport {
  reloadEnvFromFile(CARINA_ENV_PATH, false);
  return auditSecrets({ includeProcessEnv: true });
}

export function writeSecretsReviewReport(
  report: SecretsAuditReport,
  homeDir = CARINA_HOME,
): string {
  const outPath = path.join(homeDir, 'doctor-secrets-review.json');
  fs.mkdirSync(homeDir, { recursive: true });
  const payload = {
    generatedAt: report.generatedAt,
    summary: report.summary,
    issues: report.findings.filter((f) => f.severity !== 'ok'),
    precedenceDrift: report.precedenceDrift,
    unresolvedRefs: report.unresolvedRefs,
    nextStep: 'Run: carina secrets review',
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  return outPath;
}
