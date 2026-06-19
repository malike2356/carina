import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { runBinary } from '../exec.js';
import { readFile } from 'node:fs/promises';
import {
  clampInt,
  sanitizeDomain,
  sanitizeInterface,
  sanitizeNtlmHash,
  sanitizePath,
  sanitizeTarget,
  sanitizeWindowsUser,
} from '../sanitize.js';

const SNORT_ALERT_MODES = new Set(['fast', 'full', 'console', 'none']);
const DEFAULT_SNORT_CONFIG = '/etc/snort/snort.conf';
const DEFAULT_SNORT_LOG = '/var/log/snort';
const DEFAULT_DAQ_DIR = '/usr/lib/daq';
const BLOODHOUND_COLLECTION = new Set([
  'Default', 'Session', 'Group', 'ACL', 'Trusts', 'DCOM', 'ObjectProps',
  'RDP', 'Container', 'GPOLocalGroup', 'LoggedOn', 'All',
]);

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

function buildSnortArgs(params: Record<string, unknown>): string[] | { error: string } {
  const action = String(params.action ?? 'monitor');
  const configFile = sanitizePath(params.configFile ?? DEFAULT_SNORT_CONFIG);
  if (typeof configFile !== 'string') return configFile;

  if (action === 'test') {
    return ['-T', '-c', configFile];
  }

  const iface = sanitizeInterface(params.interface ?? params.iface);
  if (typeof iface !== 'string') return iface;

  const logDir = sanitizePath(params.logDir ?? DEFAULT_SNORT_LOG);
  if (typeof logDir !== 'string') return logDir;

  const alertMode = String(params.alertMode ?? 'fast').toLowerCase();
  if (!SNORT_ALERT_MODES.has(alertMode)) {
    return { error: `unsupported snort alert mode: ${alertMode}` };
  }

  const args = ['-i', iface, '-c', configFile, '-l', logDir];
  if (alertMode !== 'none') args.push('-A', alertMode);

  const daqDir = params.daqDir ?? process.env.SNORT_DAQ_DIR ?? DEFAULT_DAQ_DIR;
  const daqPath = sanitizePath(String(daqDir));
  if (typeof daqPath === 'string') args.push('--daq-dir', daqPath);

  if (params.rulesDir) {
    const rulesDir = sanitizePath(params.rulesDir);
    if (typeof rulesDir !== 'string') return rulesDir;
    args.push('--rule-path', rulesDir);
  }

  return args;
}

export function parseSnortAlerts(text: string): Array<{
  priority?: number;
  protocol?: string;
  src?: string;
  dst?: string;
  message?: string;
  raw: string;
}> {
  const alerts: Array<{
    priority?: number;
    protocol?: string;
    src?: string;
    dst?: string;
    message?: string;
    raw: string;
  }> = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fast = trimmed.match(
      /(?:\*\*\*)?\s*(?:\[Priority:\s*(\d+)\])?\s*(\S+)\s+(\S+)\s+->\s+(\S+)\s*(.*)/,
    );
    if (fast) {
      alerts.push({
        priority: fast[1] ? Number(fast[1]) : undefined,
        protocol: fast[2],
        src: fast[3],
        dst: fast[4],
        message: fast[5]?.trim() || undefined,
        raw: trimmed,
      });
      continue;
    }

    alerts.push({ raw: trimmed });
  }

  return alerts;
}

export function createSnortTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['monitor', 'test', 'alerts'], description: 'Snort action' },
        interface: { type: 'string', description: 'Network interface to monitor' },
        configFile: { type: 'string', description: 'Snort configuration file' },
        rulesDir: { type: 'string', description: 'Custom rules directory' },
        alertMode: { type: 'string', enum: ['fast', 'full', 'console', 'none'], description: 'Alert output mode' },
        logDir: { type: 'string', description: 'Snort log directory' },
        daqDir: { type: 'string', description: 'DAQ module directory' },
        alertFile: { type: 'string', description: 'Alert log file to parse' },
        threshold: { type: 'number', description: 'Minimum priority when parsing alerts' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    needsConfirmation: (params) => String(params.action ?? 'monitor') === 'monitor',
    execute: async (params) => {
      const action = String(params.action ?? 'monitor');
      const startedAt = Date.now();

      if (action === 'alerts') {
        const alertFile = sanitizePath(
          params.alertFile ?? `${params.logDir ?? DEFAULT_SNORT_LOG}/alert`,
        );
        if (typeof alertFile !== 'string') return alertFile;

        try {
          const text = await readFile(alertFile, 'utf8');
          const minPriority = clampInt(params.threshold, 0, 0, 255);
          let alerts = parseSnortAlerts(text);
          if (minPriority > 0) {
            alerts = alerts.filter((row) => (row.priority ?? 999) <= minPriority);
          }
          return {
            tool: 'snort',
            action,
            alertFile,
            alertCount: alerts.length,
            alerts,
          };
        } catch (err) {
          return {
            tool: 'snort',
            action,
            alertFile,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      const built = buildSnortArgs(params);
      if ('error' in built) return built;

      const timeoutMs = clampInt(params.timeout, 86_400, 30, 86_400) * 1000;
      const result = await runBinary('snort', built, timeoutMs);
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

      return {
        tool: 'snort',
        action,
        interface: params.interface,
        configFile: params.configFile ?? DEFAULT_SNORT_CONFIG,
        logDir: params.logDir ?? DEFAULT_SNORT_LOG,
        alertMode: params.alertMode ?? 'fast',
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        output,
        configValid: action === 'test' ? result.exitCode === 0 : undefined,
        monitorStarted: action === 'monitor' && result.exitCode === 0,
      };
    },
  };
}

function buildBloodhoundArgs(params: Record<string, unknown>): string[] | { error: string } {
  const domain = sanitizeDomain(params.domain);
  if (typeof domain !== 'string') return domain;

  const username = sanitizeWindowsUser(params.username);
  if (typeof username !== 'string') return username;

  const outputDir = sanitizePath(params.outputDir);
  if (typeof outputDir !== 'string') return outputDir;

  const args = ['-d', domain, '-u', username, '--zip', '-o', outputDir];

  if (params.hash) {
    const hash = sanitizeNtlmHash(params.hash);
    if (typeof hash !== 'string') return hash;
    args.push('--hashes', `:${hash}`);
  } else if (params.password) {
    args.push('-p', String(params.password));
  } else {
    return { error: 'password or hash is required for bloodhound collection' };
  }

  if (params.dc) {
    const dc = sanitizeTarget(params.dc);
    if (typeof dc !== 'string') return dc;
    args.push('-dc', dc);
  }

  const methods = csvList(params.collectionMethod ?? params.collection, ['Default']);
  for (const method of methods) {
    if (!BLOODHOUND_COLLECTION.has(method)) {
      return { error: `unsupported bloodhound collection method: ${method}` };
    }
  }
  args.push('-c', methods.join(','));

  if (params.dnsServer) {
    const dns = sanitizeTarget(params.dnsServer);
    if (typeof dns !== 'string') return dns;
    args.push('-ns', dns);
  }

  return args;
}

export function createBloodhoundTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 3_600_000,
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Active Directory domain' },
        username: { type: 'string', description: 'Domain username' },
        password: { type: 'string', description: 'Domain password' },
        hash: { type: 'string', description: 'NTLM hash for pass-the-hash' },
        dc: { type: 'string', description: 'Domain controller hostname or IP' },
        dnsServer: { type: 'string', description: 'DNS server for domain resolution' },
        collectionMethod: { type: 'array', description: 'BloodHound collection methods' },
        collection: { type: 'string', description: 'Collection methods CSV alias' },
        outputDir: { type: 'string', description: 'Output directory for zip bundle' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['domain', 'username', 'outputDir'],
    },
    buildArgs: (params) => buildBloodhoundArgs(params),
    resolveBinary: () => 'bloodhound-python',
    formatResult: (result, params, startedAt) => ({
      tool: 'bloodhound',
      domain: String(params.domain ?? ''),
      username: String(params.username ?? ''),
      outputDir: params.outputDir,
      collectionMethod: csvList(params.collectionMethod ?? params.collection, ['Default']),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.needsConfirmation = () => true;
  return tool;
}
