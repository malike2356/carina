import fs from 'fs';
import path from 'path';

export type ScoutControlMode = 'monitor' | 'enforce';
export type ScoutAlertMinimumSeverity = 'info' | 'warning' | 'critical' | 'breach';

export interface ScoutControlSettings {
  mode: ScoutControlMode | null;
  alertMinimumSeverity: ScoutAlertMinimumSeverity;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_ALERT_MINIMUM: ScoutAlertMinimumSeverity = 'critical';
let cached: { mtimeMs: number; value: ScoutControlSettings | null } | null = null;

function settingsPath(): string {
  return process.env.SCOUT_CONTROL_SETTINGS_PATH?.trim()
    || path.join(process.cwd(), 'data', 'scout-control-settings.json');
}

export function parseScoutControlMode(value: unknown): ScoutControlMode | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'enforce' || raw === 'enforced' || raw === 'defend' || raw === 'defense') {
    return 'enforce';
  }
  if (raw === 'monitor' || raw === 'monitor_only' || raw === 'observe') {
    return 'monitor';
  }
  return null;
}

export function parseScoutAlertMinimumSeverity(value: unknown): ScoutAlertMinimumSeverity {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'breach') return 'breach';
  if (raw === 'critical') return 'critical';
  if (raw === 'warning') return 'warning';
  if (raw === 'info' || raw === 'all') return 'info';
  return DEFAULT_ALERT_MINIMUM;
}

function readFileSettings(): ScoutControlSettings | null {
  const file = settingsPath();
  try {
    const stat = fs.statSync(file);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    const value: ScoutControlSettings = {
      mode: parseScoutControlMode(parsed.mode),
      alertMinimumSeverity: parseScoutAlertMinimumSeverity(parsed.alertMinimumSeverity),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : undefined,
    };
    cached = { mtimeMs: stat.mtimeMs, value };
    return value;
  } catch {
    cached = null;
    return null;
  }
}

export function readScoutControlSettings(): ScoutControlSettings {
  return readFileSettings() ?? {
    mode: null,
    alertMinimumSeverity: DEFAULT_ALERT_MINIMUM,
  };
}

export function writeScoutControlSettings(input: {
  mode: ScoutControlMode;
  alertMinimumSeverity?: ScoutAlertMinimumSeverity;
  updatedBy?: string;
}): ScoutControlSettings {
  const current = readScoutControlSettings();
  const next: ScoutControlSettings = {
    mode: input.mode,
    alertMinimumSeverity: input.alertMinimumSeverity ?? current.alertMinimumSeverity,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  cached = null;
  return next;
}

function envDefaultControlMode(): ScoutControlMode {
  if (process.env.SCOUT_ENFORCEMENT_ENABLED === 'false') return 'monitor';
  if (process.env.LABYRINTH_ENFORCEMENT_ENABLED === 'false') return 'monitor';
  return parseScoutControlMode(process.env.SCOUT_CONTROL_MODE ?? process.env.LABYRINTH_CONTROL_MODE)
    ?? 'enforce';
}

export function effectiveScoutControlMode(): ScoutControlMode {
  return readScoutControlSettings().mode ?? envDefaultControlMode();
}

function severityRank(raw: unknown): number {
  const severity = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (severity === 'breach') return 4;
  if (severity === 'critical') return 3;
  if (severity === 'high' || severity === 'error') return 2;
  if (severity === 'warning' || severity === 'warn') return 1;
  return 0;
}

export function shouldForwardScoutAlert(rawSeverity: unknown): boolean {
  const minimum = readScoutControlSettings().alertMinimumSeverity;
  if (minimum === 'info') return true;
  if (minimum === 'warning') return severityRank(rawSeverity) >= 1;
  if (minimum === 'breach') return String(rawSeverity ?? '').toLowerCase() === 'breach';
  return severityRank(rawSeverity) >= 3;
}
