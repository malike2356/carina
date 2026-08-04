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

  const labyrinthEnabled = process.env.LABYRINTH_ENABLED === 'true';
  if (labyrinthEnabled) {
    const url = (process.env.LABYRINTH_URL ?? '').trim();
    const apiKey = (process.env.LABYRINTH_API_KEY ?? '').trim();
    if (!url || !apiKey) {
      push('scout', 'Scout integration', 'fail', 'LABYRINTH_ENABLED=true but URL or API key missing');
    } else {
      let reachable = false;
      try {
        const healthUrl = `${url.replace(/\/$/, '')}/api/status`;
        const res = await fetch(healthUrl, {
          headers: { 'X-Scout-Key': apiKey },
          signal: AbortSignal.timeout(4000),
        });
        reachable = res.ok;
        push(
          'scout',
          'Scout integration',
          reachable ? 'ok' : 'fail',
          reachable ? `enabled and reachable (${url})` : `enabled but unreachable (HTTP ${res.status})`,
        );
      } catch (err) {
        push(
          'scout',
          'Scout integration',
          'fail',
          `enabled but unreachable: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } else {
    push('scout', 'Scout integration', 'ok', 'disabled (keep off until Scout is configured)');
  }

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
  const isProd = process.env.NODE_ENV === 'production';
  push(
    'cors',
    'CORS origin',
    cors === '*' && isProd ? 'fail' : cors === '*' ? 'warn' : 'ok',
    cors === '*' ? (isProd ? 'wildcard not allowed in production' : 'wildcard (tighten for production)') : cors,
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
      const { createRedisClient } = await import('../lib/redis.js');
      const probe = createRedisClient({
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      try {
        await probe.connect();
        await probe.ping();
        redisOk = true;
      } finally {
        try {
          probe.disconnect();
        } catch {
          // ignore
        }
      }
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

  try {
    const { collectSecurityDoctorChecks } = await import('../security/security-doctor.js');
    for (const check of collectSecurityDoctorChecks()) {
      push(check.id, check.name, check.severity, check.detail);
    }
  } catch (err) {
    push(
      'security-doctor',
      'Security doctor',
      'warn',
      err instanceof Error ? err.message : String(err),
    );
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
