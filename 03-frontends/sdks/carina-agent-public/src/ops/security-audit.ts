import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import { checkDocker } from '../tools/sandbox.js';
import { sandboxStatus } from './sandbox-containers.js';

export type AuditCheck = {
  id: string;
  name: string;
  severity: 'ok' | 'warn' | 'fail';
  detail: string;
};

export type SecurityAuditReport = {
  generatedAt: string;
  checks: AuditCheck[];
  summary: { ok: number; warn: number; fail: number };
};

function modeBits(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mode & 0o777;
  } catch {
    return null;
  }
}

export async function runSecurityAudit(): Promise<SecurityAuditReport> {
  const checks: AuditCheck[] = [];

  const push = (
    id: string,
    name: string,
    severity: AuditCheck['severity'],
    detail: string,
  ): void => {
    checks.push({ id, name, severity, detail });
  };

  push(
    'scout',
    'Scout integration',
    process.env.LABYRINTH_ENABLED === 'true' ? 'ok' : 'warn',
    process.env.LABYRINTH_ENABLED === 'true' ? 'enabled' : 'optional (off)',
  );

  push(
    'prompt-guard',
    'Prompt guard',
    process.env.CARINA_PROMPT_GUARD === 'false' ? 'warn' : 'ok',
    process.env.CARINA_PROMPT_GUARD === 'false' ? 'disabled' : 'enabled (default)',
  );

  push(
    'egress-filter',
    'Egress filter',
    process.env.CARINA_EGRESS_FILTER === 'true' ? 'ok' : 'warn',
    process.env.CARINA_EGRESS_FILTER === 'true' ? 'enabled' : 'not enabled',
  );

  push(
    'deception',
    'Deception layer',
    process.env.CARINA_DECEPTION_ENABLED === 'true' ? 'ok' : 'warn',
    process.env.CARINA_DECEPTION_ENABLED === 'true' ? 'enabled' : 'not enabled',
  );

  const docker = await checkDocker();
  const sandboxOn = process.env.CARINA_SANDBOX_ENABLED === 'true';
  push(
    'sandbox',
    'Sandbox execution',
    sandboxOn && docker ? 'ok' : sandboxOn && !docker ? 'fail' : 'warn',
    sandboxOn
      ? docker ? 'docker sandbox on' : 'CARINA_SANDBOX_ENABLED but Docker missing'
      : 'host execution (set CARINA_SANDBOX_ENABLED=true)',
  );

  const sb = await sandboxStatus();
  push(
    'sandbox-containers',
    'Managed sandbox containers',
    sb.docker ? 'ok' : 'warn',
    sb.docker ? `${sb.running}/${sb.total} running` : 'Docker unavailable',
  );

  const envMode = modeBits(CARINA_ENV_PATH);
  if (envMode === null) {
    push('env-file', '.env permissions', 'warn', 'no .env file');
  } else if (envMode > 0o600) {
    push('env-file', '.env permissions', 'warn', `mode ${envMode.toString(8)} (recommend 600)`);
  } else {
    push('env-file', '.env permissions', 'ok', `mode ${envMode.toString(8)}`);
  }

  const homeMode = modeBits(CARINA_HOME);
  push(
    'carina-home',
    'CARINA_HOME permissions',
    homeMode !== null && homeMode <= 0o700 ? 'ok' : 'warn',
    homeMode !== null ? `mode ${homeMode.toString(8)}` : 'missing',
  );

  const cors = process.env.CORS_ORIGIN ?? '*';
  push(
    'cors',
    'CORS origin',
    cors === '*' ? 'warn' : 'ok',
    cors === '*' ? 'wildcard (tighten for production)' : cors,
  );

  const webPassword = process.env.CARINA_WEB_PASSWORD ?? '';
  push(
    'web-auth',
    'Web UI password',
    webPassword.length >= 12 ? 'ok' : webPassword ? 'warn' : 'warn',
    webPassword ? (webPassword.length >= 12 ? 'set' : 'short password') : 'not set',
  );

  const opsToken = process.env.CARINA_OPS_TOKEN ?? '';
  push(
    'ops-token',
    'Ops API token',
    opsToken.length >= 16 ? 'ok' : 'warn',
    opsToken ? 'set' : 'falls back to CARINA_WEB_PASSWORD or unset',
  );

  try {
    const patternsPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'security',
      'injection-patterns.json',
    );
    const raw = fs.readFileSync(patternsPath, 'utf-8');
    const patterns = JSON.parse(raw) as unknown[];
    push(
      'injection-patterns',
      'Injection pattern pack',
      Array.isArray(patterns) && patterns.length > 0 ? 'ok' : 'fail',
      `${Array.isArray(patterns) ? patterns.length : 0} patterns loaded`,
    );
  } catch (err) {
    push(
      'injection-patterns',
      'Injection pattern pack',
      'fail',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (process.env.REDIS_URL) {
    let redisOk = false;
    try {
      const { initRedis, getRedis } = await import('../memory/redis.js');
      await initRedis();
      const r = getRedis();
      if (r) await r.ping();
      redisOk = true;
      r?.disconnect();
    } catch (err) {
      push(
        'redis',
        'Redis (kill switch)',
        'fail',
        err instanceof Error ? err.message : String(err),
      );
    }
    if (redisOk) {
      push('redis', 'Redis (kill switch)', 'ok', 'connected');
    }
  } else {
    push('redis', 'Redis (kill switch)', 'warn', 'REDIS_URL not set');
  }

  const summary = {
    ok: checks.filter((c) => c.severity === 'ok').length,
    warn: checks.filter((c) => c.severity === 'warn').length,
    fail: checks.filter((c) => c.severity === 'fail').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    checks,
    summary,
  };
}
