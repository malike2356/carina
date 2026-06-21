import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import { CHANNEL_CAPABILITIES } from '../gateway/channels/channel-capabilities.js';
import type { HealthCheck } from './health-check.js';

export type EnvAlias = {
  deprecated: string;
  canonical: string;
  guidance: string;
};

/** Deprecated env names still accepted at runtime; doctor can migrate them into .env. */
export const ENV_ALIASES: EnvAlias[] = [
  {
    deprecated: 'KARINA_HOME',
    canonical: 'CARINA_HOME',
    guidance: 'Rename KARINA_HOME to CARINA_HOME in your shell profile and .env.',
  },
  {
    deprecated: 'GATEWAY_PORT',
    canonical: 'WEB_PORT',
    guidance: 'Use WEB_PORT for the Carina web gateway listen port.',
  },
  {
    deprecated: 'CARINA_GATEWAY_PORT',
    canonical: 'WEB_PORT',
    guidance: 'Use WEB_PORT for the Carina web gateway listen port.',
  },
];

const CONTEXT_BUDGET_KEYS = [
  'CARINA_CONTEXT_CHAR_BUDGET',
  'CARINA_CONTEXT_TOKEN_BUDGET',
  'CARINA_MAX_MEMORY_CONTEXT',
] as const;

const DEFAULT_CONTEXT_BUDGETS: Record<string, string> = {
  CARINA_CONTEXT_CHAR_BUDGET: '48000',
  CARINA_CONTEXT_TOKEN_BUDGET: '12000',
  CARINA_MAX_MEMORY_CONTEXT: '20',
};

export type StateRepairIssue = HealthCheck & {
  guidance: string;
};

function readEnvFile(envPath: string): string | null {
  if (!fs.existsSync(envPath)) return null;
  return fs.readFileSync(envPath, 'utf-8');
}

function parseEnvLines(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function isPositiveInt(value: string | undefined): boolean {
  if (!value) return false;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === value.trim();
}

export function scanEnvAliases(envPath = CARINA_ENV_PATH): StateRepairIssue[] {
  const issues: StateRepairIssue[] = [];
  const content = readEnvFile(envPath);
  if (!content) return issues;

  const vars = parseEnvLines(content);
  for (const alias of ENV_ALIASES) {
    const deprecatedSet = vars.has(alias.deprecated);
    const canonicalSet = vars.has(alias.canonical) || alias.canonical === 'CARINA_HOME';
    if (!deprecatedSet) continue;
    issues.push({
      id: `env-alias-${alias.deprecated}`,
      category: 'config',
      name: `Deprecated env: ${alias.deprecated}`,
      status: canonicalSet ? 'warn' : 'fail',
      detail: canonicalSet
        ? `${alias.deprecated} is set; prefer ${alias.canonical}`
        : `${alias.deprecated} is set without ${alias.canonical}`,
      guidance: alias.guidance,
      repairable: true,
      repairId: 'migrate-env-aliases',
    });
  }
  return issues;
}

export function scanContextEngineCompat(envPath = CARINA_ENV_PATH): StateRepairIssue[] {
  const issues: StateRepairIssue[] = [];
  const content = readEnvFile(envPath);
  if (!content) return issues;

  const vars = parseEnvLines(content);
  for (const key of CONTEXT_BUDGET_KEYS) {
    const value = vars.get(key);
    if (value == null) continue;
    if (isPositiveInt(value)) continue;
    issues.push({
      id: `context-budget-${key}`,
      category: 'config',
      name: `Invalid context budget: ${key}`,
      status: 'fail',
      detail: `${key}=${value} is not a positive integer`,
      guidance: `Set ${key} to a positive integer (default ${DEFAULT_CONTEXT_BUDGETS[key]}) or remove the line.`,
      repairable: true,
      repairId: 'repair-context-budget',
    });
  }
  return issues;
}

export function scanToolsetsLegacyFormat(homeDir = CARINA_HOME): StateRepairIssue[] {
  const toolsetsPath = path.join(homeDir, 'toolsets.yaml');
  if (!fs.existsSync(toolsetsPath)) return [];

  try {
    const raw = YAML.parse(fs.readFileSync(toolsetsPath, 'utf-8')) as Record<string, unknown>;
    const hasLegacy = (raw.enabled != null || raw.disabled != null) && raw.default == null;
    if (!hasLegacy) return [];
    return [{
      id: 'toolsets-legacy-format',
      category: 'config',
      name: 'Toolsets config format',
      status: 'warn',
      detail: 'toolsets.yaml uses legacy top-level enabled/disabled keys',
      guidance: 'Run carina doctor --repair to normalize toolsets.yaml to versioned default/platforms format.',
      repairable: true,
      repairId: 'normalize-toolsets',
    }];
  } catch (err) {
    return [{
      id: 'toolsets-parse',
      category: 'config',
      name: 'Toolsets config format',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      guidance: 'Fix YAML syntax in toolsets.yaml or remove the file to regenerate defaults.',
      repairable: false,
    }];
  }
}

export function scanChannelPlatformMismatches(homeDir = CARINA_HOME): StateRepairIssue[] {
  const toolsetsPath = path.join(homeDir, 'toolsets.yaml');
  if (!fs.existsSync(toolsetsPath)) return [];

  try {
    const raw = YAML.parse(fs.readFileSync(toolsetsPath, 'utf-8')) as {
      platforms?: Record<string, unknown>;
    };
    const platforms = raw.platforms ?? {};
    const known = new Set(Object.keys(CHANNEL_CAPABILITIES));
    const unknown = Object.keys(platforms).filter((p) => !known.has(p));
    if (unknown.length === 0) return [];

    return [{
      id: 'channel-platform-mismatch',
      category: 'config',
      name: 'Channel platform overrides',
      status: 'warn',
      detail: `Unknown platform keys in toolsets.yaml: ${unknown.join(', ')}`,
      guidance: 'Remove stale platform keys or fix typos. Run carina doctor --repair to prune unknown platforms.',
      repairable: true,
      repairId: 'prune-channel-platforms',
    }];
  } catch {
    return [];
  }
}

export function scanLegacyDevicePairing(homeDir = CARINA_HOME): StateRepairIssue[] {
  const legacy = path.join(homeDir, 'pairing.json');
  const devices = path.join(homeDir, 'devices.json');
  if (!fs.existsSync(legacy) || fs.existsSync(devices)) return [];

  return [{
    id: 'legacy-device-pairing',
    category: 'ops',
    name: 'Legacy pairing store',
    status: 'warn',
    detail: 'pairing.json found without devices.json',
    guidance: 'Run carina doctor --repair to migrate pairing.json into devices.json.',
    repairable: true,
    repairId: 'migrate-legacy-pairing',
  }];
}

export function scanAcpStoreFormat(homeDir = CARINA_HOME): StateRepairIssue[] {
  const storePath = path.join(homeDir, 'acp-sessions.json');
  if (!fs.existsSync(storePath)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as unknown;
    if (Array.isArray(raw)) {
      return [{
        id: 'acp-store-legacy-array',
        category: 'ops',
        name: 'ACP session store format',
        status: 'warn',
        detail: 'acp-sessions.json is a legacy array; expected { version, sessions }',
        guidance: 'Run carina doctor --repair to wrap sessions in the versioned store format.',
        repairable: true,
        repairId: 'repair-acp-store',
      }];
    }
    if (raw && typeof raw === 'object' && !('version' in (raw as object))) {
      return [{
        id: 'acp-store-missing-version',
        category: 'ops',
        name: 'ACP session store format',
        status: 'warn',
        detail: 'acp-sessions.json missing version field',
        guidance: 'Run carina doctor --repair to add version: 1 to the ACP store.',
        repairable: true,
        repairId: 'repair-acp-store',
      }];
    }
  } catch (err) {
    return [{
      id: 'acp-store-corrupt',
      category: 'ops',
      name: 'ACP session store format',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      guidance: 'Back up and delete acp-sessions.json; it will be recreated on the next ACP session.',
      repairable: true,
      repairId: 'repair-acp-store',
    }];
  }
  return [];
}

export function scanStateRepair(homeDir = CARINA_HOME, envPath = CARINA_ENV_PATH): StateRepairIssue[] {
  return [
    ...scanEnvAliases(envPath),
    ...scanContextEngineCompat(envPath),
    ...scanToolsetsLegacyFormat(homeDir),
    ...scanChannelPlatformMismatches(homeDir),
    ...scanLegacyDevicePairing(homeDir),
    ...scanAcpStoreFormat(homeDir),
  ];
}

export type StateRepairResult = {
  applied: string | null;
  guidance?: string;
};

function rewriteEnvFile(
  envPath: string,
  mutator: (lines: string[], vars: Map<string, string>) => void,
): boolean {
  if (!fs.existsSync(envPath)) return false;
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const vars = parseEnvLines(content);
  mutator(lines, vars);
  fs.writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
  return true;
}

export async function applyStateRepair(
  repairId: string,
  homeDir = CARINA_HOME,
  envPath = CARINA_ENV_PATH,
): Promise<StateRepairResult> {
  if (repairId === 'migrate-env-aliases') {
    if (!fs.existsSync(envPath)) {
      return { applied: null, guidance: 'Create .env first (carina onboard or carina setup).' };
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const vars = parseEnvLines(content);
    const additions: string[] = [];
    for (const alias of ENV_ALIASES) {
      const deprecatedValue = vars.get(alias.deprecated);
      if (!deprecatedValue) continue;
      if (alias.canonical === 'CARINA_HOME') {
        additions.push(`# migrated from ${alias.deprecated}; set CARINA_HOME in your shell if needed`);
        continue;
      }
      if (!vars.has(alias.canonical)) {
        additions.push(`${alias.canonical}=${deprecatedValue}`);
      }
      additions.push(`# deprecated: ${alias.deprecated} (remove after verifying ${alias.canonical})`);
    }
    if (additions.length === 0) {
      return { applied: null, guidance: 'No deprecated env aliases need migration.' };
    }
    fs.appendFileSync(envPath, `\n# doctor repair: env aliases\n${additions.join('\n')}\n`, { mode: 0o600 });
    return { applied: `migrated env aliases (${additions.length} line(s))`, guidance: ENV_ALIASES[0]?.guidance };
  }

  if (repairId === 'repair-context-budget') {
    if (!rewriteEnvFile(envPath, (lines) => {
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq);
        const value = trimmed.slice(eq + 1);
        if (!(CONTEXT_BUDGET_KEYS as readonly string[]).includes(key)) continue;
        if (!isPositiveInt(value)) {
          lines[i] = `${key}=${DEFAULT_CONTEXT_BUDGETS[key]}`;
        }
      }
    })) {
      return { applied: null, guidance: 'No .env file to repair context budgets.' };
    }
    return {
      applied: 'reset invalid context budget env vars to defaults',
      guidance: 'Restart the gateway after changing context budget settings.',
    };
  }

  if (repairId === 'normalize-toolsets') {
    const { loadToolsetsConfig, saveToolsetsConfig } = await import('../tools/toolset-config.js');
    const config = loadToolsetsConfig(path.join(homeDir, 'toolsets.yaml'));
    await saveToolsetsConfig(config, path.join(homeDir, 'toolsets.yaml'));
    return {
      applied: 'normalized toolsets.yaml to versioned format',
      guidance: 'Review toolsets.yaml; platform overrides are under platforms:.',
    };
  }

  if (repairId === 'prune-channel-platforms') {
    const toolsetsPath = path.join(homeDir, 'toolsets.yaml');
    if (!fs.existsSync(toolsetsPath)) {
      return { applied: null, guidance: 'No toolsets.yaml to prune.' };
    }
    const raw = YAML.parse(fs.readFileSync(toolsetsPath, 'utf-8')) as {
      platforms?: Record<string, unknown>;
      version?: number;
      default?: unknown;
    };
    const platforms = raw.platforms ?? {};
    const known = new Set(Object.keys(CHANNEL_CAPABILITIES));
    const pruned: string[] = [];
    for (const key of Object.keys(platforms)) {
      if (!known.has(key)) {
        delete platforms[key];
        pruned.push(key);
      }
    }
    if (pruned.length === 0) {
      return { applied: null, guidance: 'No unknown platform keys to prune.' };
    }
    raw.platforms = platforms;
    fs.writeFileSync(toolsetsPath, YAML.stringify(raw), { mode: 0o600 });
    return {
      applied: `pruned unknown platform keys: ${pruned.join(', ')}`,
      guidance: 'Use carina channels status to see configured channels.',
    };
  }

  if (repairId === 'migrate-legacy-pairing') {
    const { migrateLegacyPairingStore } = await import('../infrastructure/device-pairing.js');
    const result = migrateLegacyPairingStore(homeDir);
    if (!result.migrated) {
      return { applied: null, guidance: result.guidance ?? 'No legacy pairing store to migrate.' };
    }
    return {
      applied: result.message ?? 'migrated pairing.json to devices.json',
      guidance: 'Legacy pairing.json was removed after migration.',
    };
  }

  if (repairId === 'repair-acp-store') {
    const storePath = path.join(homeDir, 'acp-sessions.json');
    if (!fs.existsSync(storePath)) {
      return { applied: null, guidance: 'ACP store will be created on first ACP session.' };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as unknown;
      if (Array.isArray(raw)) {
        const normalized = { version: 1, sessions: raw };
        fs.writeFileSync(storePath, JSON.stringify(normalized, null, 2), { mode: 0o600 });
        return {
          applied: 'wrapped legacy ACP session array in versioned store',
          guidance: 'ACP sessions were preserved during format repair.',
        };
      }
      if (raw && typeof raw === 'object') {
        const obj = raw as { sessions?: unknown[]; version?: number };
        obj.version = 1;
        obj.sessions = Array.isArray(obj.sessions) ? obj.sessions : [];
        fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), { mode: 0o600 });
        return { applied: 'repaired ACP store version field', guidance: 'ACP store is now version 1.' };
      }
    } catch {
      const backup = `${storePath}.bak-${Date.now()}`;
      fs.copyFileSync(storePath, backup);
      fs.writeFileSync(storePath, JSON.stringify({ version: 1, sessions: [] }, null, 2), { mode: 0o600 });
      return {
        applied: `reset corrupt ACP store (backup: ${backup})`,
        guidance: 'Corrupt acp-sessions.json was reset; backup kept alongside.',
      };
    }
  }

  return { applied: null, guidance: `Unknown repair id: ${repairId}` };
}

export async function applyAllStateRepairs(
  issues: StateRepairIssue[],
  homeDir = CARINA_HOME,
  envPath = CARINA_ENV_PATH,
): Promise<{ applied: string[]; skipped: string[]; guidance: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const guidance: string[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    if (!issue.repairable || !issue.repairId || seen.has(issue.repairId)) continue;
    seen.add(issue.repairId);
    const result = await applyStateRepair(issue.repairId, homeDir, envPath);
    if (result.applied) applied.push(result.applied);
    else skipped.push(issue.repairId);
    if (result.guidance) guidance.push(result.guidance);
    if (issue.guidance) guidance.push(issue.guidance);
  }

  return { applied, skipped, guidance };
}