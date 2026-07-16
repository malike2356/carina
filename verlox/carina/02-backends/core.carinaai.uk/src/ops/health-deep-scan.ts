import fs from 'fs';
import path from 'path';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import type { HealthCheck } from './health-check.js';

export type DeepScanResult = {
  checks: HealthCheck[];
  artifacts: string[];
};

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function dirWritable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function runDeepScan(): Promise<DeepScanResult> {
  const checks: HealthCheck[] = [];
  const artifacts: string[] = [];

  const push = (check: HealthCheck) => checks.push(check);

  const logDir = path.join(CARINA_HOME, 'data', 'logs');
  push({
    id: 'deep-log-dir',
    category: 'ops',
    name: 'Log directory',
    status: dirWritable(logDir) || !fileExists(logDir) ? 'ok' : 'fail',
    detail: logDir,
    repairable: !fileExists(logDir),
    repairId: 'mkdir-logs',
  });

  const turnLog = path.join(logDir, 'turns.jsonl');
  push({
    id: 'deep-turn-log',
    category: 'ops',
    name: 'Turn log file',
    status: fileExists(turnLog) ? 'ok' : 'warn',
    detail: fileExists(turnLog) ? turnLog : 'not created yet (first chat turn)',
  });

  const acpStore = path.join(CARINA_HOME, 'acp-sessions.json');
  push({
    id: 'deep-acp-store',
    category: 'ops',
    name: 'ACP session store',
    status: process.env.CARINA_ACP_ENABLED === 'true'
      ? (fileExists(acpStore) ? 'ok' : 'warn')
      : 'ok',
    detail: process.env.CARINA_ACP_ENABLED === 'true'
      ? (fileExists(acpStore) ? acpStore : 'will be created on first ACP session')
      : 'ACP disabled',
  });

  const nodeAudit = path.join(CARINA_HOME, 'node-audit.jsonl');
  if (process.env.CARINA_NODE_HOST_ENABLED === 'true') {
    push({
      id: 'deep-node-audit',
      category: 'ops',
      name: 'Node audit log',
      status: fileExists(nodeAudit) ? 'ok' : 'warn',
      detail: fileExists(nodeAudit) ? nodeAudit : 'no node events yet',
    });
  }

  const extensionsDir = path.join(CARINA_HOME, 'extensions');
  push({
    id: 'deep-extensions-dir',
    category: 'config',
    name: 'Extensions directory',
    status: fileExists(extensionsDir) ? 'ok' : 'warn',
    detail: extensionsDir,
    repairable: !fileExists(extensionsDir),
    repairId: 'mkdir-extensions',
  });

  if (fs.existsSync(CARINA_ENV_PATH)) {
    const mode = fs.statSync(CARINA_ENV_PATH).mode & 0o777;
    const groupReadable = (mode & 0o040) !== 0 || (mode & 0o004) !== 0;
    push({
      id: 'deep-env-group-read',
      category: 'security',
      name: 'Env file group/other read',
      status: groupReadable ? 'fail' : 'ok',
      detail: groupReadable ? `mode ${mode.toString(8)} exposes secrets` : `mode ${mode.toString(8)}`,
      repairable: groupReadable,
      repairId: 'chmod-env',
    });
  }

  try {
    const { gatewayOpsTokenStatus } = await import('./gateway-token.js');
    const tokenStatus = gatewayOpsTokenStatus();
    push({
      id: 'deep-ops-token',
      category: 'security',
      name: 'Gateway ops token',
      status: !tokenStatus.configured ? 'fail' : tokenStatus.weak ? 'warn' : 'ok',
      detail: tokenStatus.configured
        ? `${tokenStatus.source} (${tokenStatus.length} chars)`
        : 'CARINA_OPS_TOKEN not set',
      repairable: !tokenStatus.configured || tokenStatus.weak,
      repairId: 'generate-ops-token',
    });
  } catch (err) {
    push({
      id: 'deep-ops-token',
      category: 'security',
      name: 'Gateway ops token',
      status: 'warn',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (process.env.CARINA_EXTENSIONS_ENABLED === 'true') {
    try {
      const { listExtensions } = await import('../extensions/manager.js');
      const extensions = await listExtensions();
      const broken = extensions.filter((e) => e.status === 'error');
      push({
        id: 'deep-extensions-health',
        category: 'deps',
        name: 'Extension bundles',
        status: broken.length > 0 ? 'warn' : 'ok',
        detail: `${extensions.length} loaded, ${broken.length} error`,
      });
    } catch {
      push({
        id: 'deep-extensions-health',
        category: 'deps',
        name: 'Extension bundles',
        status: 'warn',
        detail: 'extension manager unavailable',
      });
    }
  }

  for (const artifact of [turnLog, nodeAudit, acpStore]) {
    if (fileExists(artifact)) artifacts.push(artifact);
  }

  return { checks, artifacts };
}

export async function applyDeepScanRepair(repairId: string): Promise<string | null> {
  if (repairId === 'mkdir-logs') {
    fs.mkdirSync(path.join(CARINA_HOME, 'data', 'logs'), { recursive: true, mode: 0o700 });
    return 'created data/logs';
  }
  if (repairId === 'mkdir-extensions') {
    fs.mkdirSync(path.join(CARINA_HOME, 'extensions'), { recursive: true, mode: 0o700 });
    return 'created extensions directory';
  }
  if (repairId === 'chmod-env' && fs.existsSync(CARINA_ENV_PATH)) {
    fs.chmodSync(CARINA_ENV_PATH, 0o600);
    return 'chmod 600 .env';
  }
  if (repairId === 'generate-ops-token') {
    const { ensureGatewayOpsToken } = await import('./gateway-token.js');
    const result = await ensureGatewayOpsToken();
    return result.created ? `generated CARINA_OPS_TOKEN in ${result.path}` : 'ops token already configured';
  }
  return null;
}
