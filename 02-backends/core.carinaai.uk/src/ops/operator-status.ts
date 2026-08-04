import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolveCarinaHome } from '../config/paths.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { listBackups } from './backup-restore.js';
import { auditSecrets } from './secrets-audit.js';
import { runHealthCheck, type HealthReport } from './health-check.js';
import { resolveKnownWebGatewayPort } from '../infrastructure/web-gateway-port.js';

export type OperatorStatusReport = {
  generatedAt: string;
  hostname: string;
  version: string;
  activeProfile: string;
  carinaHome: string;
  health: HealthReport['summary'];
  healthEndpoint: { url: string; ok: boolean; detail?: string };
  gateway: { webRunning: boolean; port: string };
  sessions: { localCount: number };
  backups: { count: number; latest?: string };
  secrets: { ok: number; warn: number; fail: number };
  update?: { current: string; latest: string; updateAvailable: boolean };
  operatorHints: string[];
};

function readVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

async function countLocalSessions(homeDir: string): Promise<number> {
  const dir = path.join(homeDir, 'sessions');
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function probeHealthEndpoint(port: string): Promise<{ ok: boolean; detail?: string }> {
  const url = `http://127.0.0.1:${port}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = await res.text();
    return { ok: true, detail: body.slice(0, 120) };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkLatestVersion(current: string): Promise<{ latest: string; updateAvailable: boolean }> {
  try {
    const res = await fetch('https://registry.npmjs.org/carina-agent/latest', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { latest: current, updateAvailable: false };
    const data = await res.json() as { version: string };
    return { latest: data.version, updateAvailable: data.version !== current };
  } catch {
    return { latest: current, updateAvailable: false };
  }
}

export type OperatorStatusOptions = {
  homeDir?: string;
  includeUpdate?: boolean;
  skipHealth?: boolean;
};

export async function buildOperatorStatus(
  options: OperatorStatusOptions = {},
): Promise<OperatorStatusReport> {
  const homeDir = options.homeDir ?? resolveCarinaHome();
  const version = readVersion();
  const activeProfile = process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
  const port = String(resolveKnownWebGatewayPort());
  const healthEndpoint = await probeHealthEndpoint(port);

  let healthSummary = { ok: 0, warn: 0, fail: 0 };
  if (!options.skipHealth) {
    const health = await runHealthCheck({ loadEnv: false });
    healthSummary = health.summary;
  }

  const secretReport = auditSecrets({ includeProcessEnv: true });
  const backupLabels = await listBackups(homeDir);
  const localCount = await countLocalSessions(homeDir);

  const hints: string[] = [];
  if (healthSummary.fail > 0) hints.push('Run: carina doctor [--repair]');
  if (secretReport.summary.fail > 0) hints.push('Run: carina secrets audit');
  if (!healthEndpoint.ok) hints.push('Start gateway: carina web');
  if (backupLabels.length === 0) hints.push('Create backup: carina backup create');

  const report: OperatorStatusReport = {
    generatedAt: new Date().toISOString(),
    hostname: os.hostname(),
    version,
    activeProfile,
    carinaHome: homeDir,
    health: healthSummary,
    healthEndpoint: { url: `http://127.0.0.1:${port}/api/health`, ...healthEndpoint },
    gateway: { webRunning: healthEndpoint.ok, port },
    sessions: { localCount },
    backups: { count: backupLabels.length, latest: backupLabels[0] },
    secrets: secretReport.summary,
    operatorHints: hints,
  };

  if (options.includeUpdate !== false) {
    const update = await checkLatestVersion(version);
    report.update = {
      current: version,
      latest: update.latest,
      updateAvailable: update.updateAvailable,
    };
    if (update.updateAvailable) hints.push('Update: carina update check');
  }

  return report;
}
