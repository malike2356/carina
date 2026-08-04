// WARDEN configuration loader
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const YAML = require('yamljs') as { load: (path: string) => Record<string, unknown> };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, '../..');

export interface WardenConfig {
  enabled: boolean;
  dry_run: boolean;
  auto_remove: boolean;
  kill_switch_on_critical: boolean;
  evidence_dir: string;
  quarantine_dir: string;
  rules_dir: string;
  signatures_dir: string;
  schedule: {
    continuous_ms: number;
    network_ms: number;
    host_ms: number;
    yara_sweep_ms: number;
    connected_ms: number;
    deep_scan_ms: number;
  };
  sensors: Record<string, boolean>;
  arsenal: Record<string, { enabled: boolean; binary?: string; base_url?: string; rules_glob?: string; analyze_headless?: string }>;
  response: {
    isolate: boolean;
    sandbox: boolean;
    immobilize: boolean;
    strip: boolean;
    remove_requires_confirmation: boolean;
    critical_high_auto_remove: boolean;
  };
  alerts: {
    dashboard: boolean;
    webhook_url: string;
    email: boolean;
    syslog: boolean;
  };
  carina: {
    watch_paths: string[];
    process_name_hints: string[];
    tool_rate_limit_per_sec: number;
  };
  scout: {
    integrity_paths: string[];
    rehash_ms: number;
  };
  network: {
    connection_whitelist_ports: number[];
    blocklist_file: string;
    domain_blocklist_file: string;
  };
}

const DEFAULT_CONFIG: WardenConfig = {
  enabled: true,
  dry_run: true,
  auto_remove: false,
  kill_switch_on_critical: true,
  evidence_dir: path.join(ENGINE_ROOT, 'data/warden/evidence'),
  quarantine_dir: path.join(ENGINE_ROOT, 'data/warden/quarantine'),
  rules_dir: path.join(ENGINE_ROOT, 'warden/rules'),
  signatures_dir: path.join(ENGINE_ROOT, 'warden/signatures'),
  schedule: {
    continuous_ms: 0,
    network_ms: 30_000,
    host_ms: 300_000,
    yara_sweep_ms: 900_000,
    connected_ms: 3_600_000,
    deep_scan_ms: 21_600_000,
  },
  sensors: {
    carina: true,
    scout: true,
    host: true,
    network: true,
    connected_systems: true,
    devices: true,
    deployed_agents: true,
    supply_chain: true,
  },
  arsenal: {
    yara: { enabled: true, binary: 'yara', rules_glob: 'custom/*.yar' },
    ghidra: { enabled: false, analyze_headless: 'analyzeHeadless' },
    capev2: { enabled: false, base_url: 'http://127.0.0.1:8000' },
    volatility: { enabled: true, binary: 'vol' },
    capa: { enabled: true, binary: 'capa' },
    x64dbg: { enabled: false, binary: 'x64dbg' },
    radare2: { enabled: true, binary: 'r2' },
    mobsf: { enabled: false, base_url: 'http://127.0.0.1:8001' },
    floss: { enabled: true, binary: 'floss' },
    drakvuf: { enabled: false, binary: 'drakvuf' },
  },
  response: {
    isolate: true,
    sandbox: true,
    immobilize: true,
    strip: true,
    remove_requires_confirmation: true,
    critical_high_auto_remove: false,
  },
  alerts: {
    dashboard: true,
    webhook_url: '',
    email: false,
    syslog: false,
  },
  carina: {
    watch_paths: [],
    process_name_hints: ['carina', 'node'],
    tool_rate_limit_per_sec: 50,
  },
  scout: {
    integrity_paths: ['package.json', 'dist/server.js', 'config/warden.yaml'],
    rehash_ms: 300_000,
  },
  network: {
    connection_whitelist_ports: [22, 80, 443, 4444, 5432, 6379],
    blocklist_file: 'signatures/ip_blocklist.txt',
    domain_blocklist_file: 'signatures/domain_blocklist.txt',
  },
};

let cached: WardenConfig | null = null;

function resolveMaybe(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(ENGINE_ROOT, p);
}

export function getEngineRoot(): string {
  return ENGINE_ROOT;
}

export function loadWardenConfig(configPath?: string): WardenConfig {
  if (cached && !configPath) return cached;

  const candidates = [
    configPath,
    process.env.WARDEN_CONFIG,
    path.join(ENGINE_ROOT, 'config/warden.yaml'),
  ].filter(Boolean) as string[];

  let loaded: Partial<WardenConfig> = {};
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      loaded = YAML.load(candidate) as Partial<WardenConfig>;
      break;
    }
  }

  const merged: WardenConfig = {
    ...DEFAULT_CONFIG,
    ...loaded,
    schedule: { ...DEFAULT_CONFIG.schedule, ...(loaded.schedule ?? {}) },
    sensors: { ...DEFAULT_CONFIG.sensors, ...(loaded.sensors ?? {}) },
    arsenal: { ...DEFAULT_CONFIG.arsenal, ...(loaded.arsenal ?? {}) },
    response: { ...DEFAULT_CONFIG.response, ...(loaded.response ?? {}) },
    alerts: { ...DEFAULT_CONFIG.alerts, ...(loaded.alerts ?? {}) },
    carina: { ...DEFAULT_CONFIG.carina, ...(loaded.carina ?? {}) },
    scout: { ...DEFAULT_CONFIG.scout, ...(loaded.scout ?? {}) },
    network: { ...DEFAULT_CONFIG.network, ...(loaded.network ?? {}) },
  };

  merged.evidence_dir = resolveMaybe(merged.evidence_dir);
  merged.quarantine_dir = resolveMaybe(merged.quarantine_dir);
  merged.rules_dir = resolveMaybe(merged.rules_dir);
  merged.signatures_dir = resolveMaybe(merged.signatures_dir);

  if (process.env.WARDEN_DRY_RUN === '0' || process.env.WARDEN_DRY_RUN === 'false') {
    merged.dry_run = false;
  }
  if (process.env.WARDEN_DRY_RUN === '1' || process.env.WARDEN_DRY_RUN === 'true') {
    merged.dry_run = true;
  }
  if (process.env.WARDEN_ENABLED === '0' || process.env.WARDEN_ENABLED === 'false') {
    merged.enabled = false;
  }

  fs.mkdirSync(merged.evidence_dir, { recursive: true });
  fs.mkdirSync(merged.quarantine_dir, { recursive: true });

  cached = merged;
  return merged;
}

export function updateWardenConfig(patch: Partial<WardenConfig>): WardenConfig {
  const current = loadWardenConfig();
  const arsenalMerged = { ...current.arsenal };
  if (patch.arsenal) {
    for (const [key, value] of Object.entries(patch.arsenal)) {
      arsenalMerged[key] = { ...(current.arsenal[key] ?? {}), ...(value ?? {}) };
    }
  }
  cached = {
    ...current,
    ...patch,
    schedule: { ...current.schedule, ...(patch.schedule ?? {}) },
    sensors: { ...current.sensors, ...(patch.sensors ?? {}) },
    arsenal: arsenalMerged,
    response: { ...current.response, ...(patch.response ?? {}) },
    alerts: { ...current.alerts, ...(patch.alerts ?? {}) },
    carina: { ...current.carina, ...(patch.carina ?? {}) },
    scout: { ...current.scout, ...(patch.scout ?? {}) },
    network: { ...current.network, ...(patch.network ?? {}) },
  };
  return cached;
}

/** Persist schedule (and optional flags) back to config/warden.yaml when present. */
export function persistWardenSchedule(schedule: Partial<WardenConfig['schedule']>): WardenConfig {
  const updated = updateWardenConfig({ schedule: schedule as WardenConfig['schedule'] });
  const configPath = process.env.WARDEN_CONFIG || path.join(ENGINE_ROOT, 'config/warden.yaml');
  if (!fs.existsSync(configPath)) return updated;

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    let next = raw;
    for (const [key, value] of Object.entries(updated.schedule)) {
      if (typeof value !== 'number') continue;
      const re = new RegExp(`(^\\s*${key}:\\s*)\\d+(\\s*)$`, 'm');
      if (re.test(next)) {
        next = next.replace(re, `$1${value}$2`);
      }
    }
    if (next !== raw) fs.writeFileSync(configPath, next, 'utf8');
  } catch (err) {
    console.warn('[warden] failed to persist schedule to yaml:', err instanceof Error ? err.message : err);
  }
  return updated;
}

export function resetWardenConfigCache(): void {
  cached = null;
}
