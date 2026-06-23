import fs from 'fs';
import os from 'os';
import path from 'path';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';

export type HealthStatus = 'ok' | 'warn' | 'fail';

export type HealthCheck = {
  id: string;
  category: 'runtime' | 'config' | 'deps' | 'security' | 'ops';
  name: string;
  status: HealthStatus;
  detail: string;
  guidance?: string;
  repairable?: boolean;
  repairId?: string;
};

export type HealthReport = {
  generatedAt: string;
  hostname: string;
  carinaHome: string;
  checks: HealthCheck[];
  summary: { ok: number; warn: number; fail: number };
  configDrift: string[];
};

async function checkHttp(url: string, headers?: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

function envMode(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mode & 0o777;
  } catch {
    return null;
  }
}

export async function runHealthCheck(options: { loadEnv?: boolean; deep?: boolean } = {}): Promise<HealthReport> {
  if (options.loadEnv !== false) {
    const { loadLocalEnv } = await import('../cli/config/env.js');
    loadLocalEnv();
  }

  const checks: HealthCheck[] = [];
  const configDrift: string[] = [];

  const push = (
    check: Omit<HealthCheck, 'status'> & { status: HealthStatus },
  ): void => {
    checks.push(check);
  };

  const nodeOk = Number(process.versions.node.split('.')[0]) >= 22;
  push({
    id: 'node',
    category: 'runtime',
    name: 'Node.js >= 22',
    status: nodeOk ? 'ok' : 'fail',
    detail: process.versions.node,
  });

  if (process.platform === 'win32') {
    const { detectWindowsPrereqs, defaultWindowsInstallHint } = await import('../windows/environment.js');
    const win = await detectWindowsPrereqs();
    push({
      id: 'windows-build',
      category: 'runtime',
      name: 'Windows build (ConPTY)',
      status: win.conptySupported ? 'ok' : 'fail',
      detail: win.buildNumber != null ? `build ${win.buildNumber}` : 'unknown build',
    });
    push({
      id: 'windows-powershell',
      category: 'runtime',
      name: 'PowerShell',
      status: win.powershellAvailable ? 'ok' : 'fail',
      detail: win.powershellAvailable ? 'available' : 'not found',
    });
    push({
      id: 'windows-carina-path',
      category: 'ops',
      name: 'carina on PATH',
      status: win.carinaOnPath ? 'ok' : 'warn',
      detail: win.carinaOnPath ? 'found' : defaultWindowsInstallHint(),
    });
    const { isWindowsGatewayTaskInstalled } = await import('../windows/schtasks-service.js');
    const taskInstalled = await isWindowsGatewayTaskInstalled();
    push({
      id: 'windows-gateway-task',
      category: 'ops',
      name: 'CarinaGateway scheduled task',
      status: taskInstalled ? 'ok' : 'warn',
      detail: taskInstalled ? 'installed' : 'optional: carina host install',
    });
  }

  push({
    id: 'carina-home',
    category: 'ops',
    name: 'CARINA_HOME',
    status: fs.existsSync(CARINA_HOME) ? 'ok' : 'fail',
    detail: CARINA_HOME,
    repairable: !fs.existsSync(CARINA_HOME),
    repairId: 'mkdir-home',
  });

  push({
    id: 'env-file',
    category: 'config',
    name: '.env file',
    status: fs.existsSync(CARINA_ENV_PATH) ? 'ok' : 'warn',
    detail: CARINA_ENV_PATH,
  });

  const envModeBits = envMode(CARINA_ENV_PATH);
  if (envModeBits !== null && envModeBits > 0o600) {
    push({
      id: 'env-perms',
      category: 'security',
      name: '.env permissions',
      status: 'warn',
      detail: `mode ${envModeBits.toString(8)} (recommend 600)`,
      repairable: true,
      repairId: 'chmod-env',
    });
  } else if (envModeBits !== null) {
    push({
      id: 'env-perms',
      category: 'security',
      name: '.env permissions',
      status: 'ok',
      detail: `mode ${envModeBits.toString(8)}`,
    });
  }

  try {
    const { checkConfig, loadFromYaml } = await import('../cli/config/loader.js');
    const { DEFAULT_CLI_CONFIG } = await import('../cli/config/defaults.js');
    const configResults = await checkConfig();
    for (const r of configResults) {
      push({
        id: `config-${r.key}`,
        category: 'config',
        name: `Config: ${r.key}`,
        status: r.ok ? 'ok' : 'fail',
        detail: r.detail,
        repairable: !r.ok,
        repairId: 'migrate-config',
      });
    }
    const raw = await loadFromYaml() as Record<string, unknown>;
    const missingKeys = Object.keys(DEFAULT_CLI_CONFIG).filter((k) => raw[k] === undefined);
    if (missingKeys.length > 0) {
      configDrift.push(`config.yaml missing keys: ${missingKeys.join(', ')}`);
    }
  } catch (err) {
    push({
      id: 'config',
      category: 'config',
      name: 'Config check',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const hasLlm = Boolean(
    process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
  );
  push({
    id: 'llm-key',
    category: 'deps',
    name: 'LLM API key',
    status: hasLlm ? 'ok' : 'fail',
    detail: hasLlm ? 'configured' : 'set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY',
  });

  const localMode = process.env.CARINA_LOCAL_MODE === 'true';
  const skipPg = process.env.CARINA_SKIP_POSTGRES === 'true' || localMode;
  if (skipPg) {
    push({
      id: 'postgres',
      category: 'deps',
      name: 'Postgres',
      status: 'ok',
      detail: 'skipped (local/sqlite mode)',
    });
  } else {
    try {
      const { initDb, pool } = await import('../memory/db.js');
      await initDb();
      await pool.query('SELECT 1');
      await pool.end();
      push({ id: 'postgres', category: 'deps', name: 'Postgres', status: 'ok', detail: 'connected' });
    } catch (err) {
      push({
        id: 'postgres',
        category: 'deps',
        name: 'Postgres',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const { initMemoryBackend, getMemoryBackend } = await import('../memory/backends/index.js');
    initMemoryBackend();
    const mem = getMemoryBackend();
    push({
      id: 'memory',
      category: 'deps',
      name: 'Memory backend',
      status: mem.isConfigured() ? 'ok' : 'warn',
      detail: `${mem.displayName} (${mem.name})`,
    });
  } catch (err) {
    push({
      id: 'memory',
      category: 'deps',
      name: 'Memory backend',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const webPort = process.env.WEB_PORT ?? '3000';
  const webOk = await checkHttp(`http://127.0.0.1:${webPort}/api/health`);
  push({
    id: 'web-gateway',
    category: 'runtime',
    name: 'Web gateway',
    status: webOk ? 'ok' : 'warn',
    detail: webOk ? `http://localhost:${webPort}` : 'not running (start: carina web)',
  });

  try {
    const audit = await import('./secrets-audit.js');
    const secretReport = audit.auditSecrets({ includeProcessEnv: true });
    push({
      id: 'secrets-plaintext',
      category: 'security',
      name: 'Secrets audit',
      status: secretReport.summary.fail > 0 ? 'fail' : secretReport.summary.warn > 0 ? 'warn' : 'ok',
      detail: `${secretReport.summary.ok} ok, ${secretReport.summary.warn} warn, ${secretReport.summary.fail} fail`,
      repairable: secretReport.summary.fail > 0 || secretReport.summary.warn > 0,
      repairId: 'secrets-review',
    });
    for (const d of secretReport.precedenceDrift) {
      configDrift.push(d);
    }
  } catch {
    push({
      id: 'secrets-plaintext',
      category: 'security',
      name: 'Secrets audit',
      status: 'warn',
      detail: 'audit module unavailable',
    });
  }

  try {
    const { collectSecurityDoctorChecks } = await import('../security/security-doctor.js');
    for (const check of collectSecurityDoctorChecks()) {
      push({
        id: `doctor-${check.id}`,
        category: 'security',
        name: check.name,
        status: check.severity,
        detail: check.detail,
      });
    }
  } catch (err) {
    push({
      id: 'security-doctor',
      category: 'security',
      name: 'Security doctor',
      status: 'warn',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { initRedis, getRedis } = await import('../memory/redis.js');
      initRedis();
      const r = getRedis();
      if (r) {
        await r.ping();
        push({ id: 'redis', category: 'deps', name: 'Redis', status: 'ok', detail: 'connected' });
      } else {
        push({ id: 'redis', category: 'deps', name: 'Redis', status: 'warn', detail: 'REDIS_URL set but client unavailable' });
      }
    } catch (err) {
      push({
        id: 'redis',
        category: 'deps',
        name: 'Redis',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const active = process.env.DEFAULT_PROVIDER ?? 'deepseek';
    const { getProviderHealth } = await import('../brain/provider-health.js');
    const health = getProviderHealth(String(active));
    push({
      id: 'provider-active',
      category: 'deps',
      name: 'Active LLM provider',
      status: health === 'unhealthy' ? 'fail' : health === 'healthy' ? 'ok' : 'warn',
      detail: `${active} (${health})`,
    });
  } catch {
    // optional
  }

  if (options.deep) {
    const { runDeepScan } = await import('./health-deep-scan.js');
    const deep = await runDeepScan();
    checks.push(...deep.checks);
  }

  try {
    const { scanStateRepair } = await import('./state-repair.js');
    const stateIssues = scanStateRepair();
    for (const issue of stateIssues) {
      checks.push({
        id: issue.id,
        category: issue.category,
        name: issue.name,
        status: issue.status,
        detail: issue.detail,
        guidance: issue.guidance,
        repairable: issue.repairable,
        repairId: issue.repairId,
      });
    }
  } catch {
    // optional
  }

  const summary = {
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    hostname: os.hostname(),
    carinaHome: CARINA_HOME,
    checks,
    summary,
    configDrift,
  };
}

export type HealthRepairResult = {
  applied: string[];
  skipped: string[];
};

export async function applyHealthRepairs(report: HealthReport): Promise<HealthRepairResult> {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const check of report.checks) {
    if (!check.repairable || !check.repairId) continue;

    if (check.repairId === 'mkdir-home') {
      fs.mkdirSync(CARINA_HOME, { recursive: true, mode: 0o700 });
      applied.push('created CARINA_HOME');
      continue;
    }

    if (check.repairId === 'chmod-env' && fs.existsSync(CARINA_ENV_PATH)) {
      fs.chmodSync(CARINA_ENV_PATH, 0o600);
      applied.push('chmod 600 .env');
      continue;
    }

    if (check.repairId === 'migrate-config') {
      const { migrateConfig } = await import('../cli/config/loader.js');
      const added = await migrateConfig();
      if (added.length > 0) applied.push(`config migrate: ${added.join(', ')}`);
      else skipped.push('config already current');
      continue;
    }

    if (check.repairId === 'secrets-review') {
      const audit = await import('./secrets-audit.js');
      const report = audit.auditSecrets({ includeProcessEnv: true });
      const issues = report.findings.filter((f) => f.severity !== 'ok');
      if (issues.length === 0) {
        skipped.push('secrets-review (no issues)');
        continue;
      }
      const outPath = audit.writeSecretsReviewReport(report);
      applied.push(`secrets review report: ${outPath}`);
      applied.push('run: carina secrets review');
      continue;
    }

    if (check.repairId === 'generate-ops-token') {
      const { ensureGatewayOpsToken } = await import('./gateway-token.js');
      const result = await ensureGatewayOpsToken();
      if (result.created) {
        applied.push(`generated CARINA_OPS_TOKEN in ${result.path}`);
      } else {
        skipped.push('generate-ops-token (already configured)');
      }
      continue;
    }

    if (check.repairId === 'mkdir-logs' || check.repairId === 'mkdir-extensions') {
      const { applyDeepScanRepair } = await import('./health-deep-scan.js');
      const msg = await applyDeepScanRepair(check.repairId);
      if (msg) applied.push(msg);
      else skipped.push(check.repairId);
      continue;
    }

    skipped.push(check.repairId);
  }

  try {
    const { scanStateRepair, applyAllStateRepairs } = await import('./state-repair.js');
    const stateResult = await applyAllStateRepairs(scanStateRepair());
    applied.push(...stateResult.applied);
    skipped.push(...stateResult.skipped);
  } catch {
    // optional
  }

  if (report.configDrift.length > 0) {
    const { migrateConfig } = await import('../cli/config/loader.js');
    const added = await migrateConfig();
    if (added.length > 0) applied.push(`config drift keys: ${added.join(', ')}`);
  }

  try {
    const { pruneExpiredGrants } = await import('../security/approval-store.js');
    const n = pruneExpiredGrants();
    if (n > 0) applied.push(`pruned ${n} expired approval grant(s)`);
  } catch {
    // optional
  }

  return { applied, skipped };
}
