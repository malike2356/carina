import { pool } from '../db.js';
import type { AlertSeverity } from '../alerts/types.js';
import { decryptSecret, encryptSecret, maskSecret } from './secret-crypto.js';
import { getPlatformSetting, setPlatformSetting } from './platform-settings.js';

export type AlertChannelType = 'telegram' | 'email' | 'slack';

const SECRET_KEYS: Record<AlertChannelType, string[]> = {
  telegram: ['bot_token'],
  email: ['resend_api_key'],
  slack: ['webhook_url'],
};

export interface AlertChannelRow {
  id: string;
  channel_type: AlertChannelType;
  severity_threshold: AlertSeverity;
  enabled: boolean;
  config: Record<string, string>;
  created_at: string;
}

export interface AlertChannelPublic {
  id: string;
  channel_type: AlertChannelType;
  severity_threshold: AlertSeverity;
  enabled: boolean;
  config: Record<string, string>;
  secrets_set: Record<string, boolean>;
}

function isChannelType(value: string): value is AlertChannelType {
  return value === 'telegram' || value === 'email' || value === 'slack';
}

function isMaskedSecret(value: string): boolean {
  return value === '********' || /^\S{1,4}\.\.\.\S{1,4}$/.test(value);
}

function encryptConfig(type: AlertChannelType, config: Record<string, string>): Record<string, string> {
  const out = { ...config };
  for (const key of SECRET_KEYS[type]) {
    const val = out[key]?.trim();
    if (val) out[key] = encryptSecret(val);
  }
  return out;
}

export function decryptConfig(type: AlertChannelType, config: Record<string, string>): Record<string, string> {
  const out = { ...config };
  for (const key of SECRET_KEYS[type]) {
    if (out[key]) out[key] = decryptSecret(out[key]);
  }
  return out;
}

function toPublic(row: AlertChannelRow): AlertChannelPublic {
  const secrets_set: Record<string, boolean> = {};
  for (const key of SECRET_KEYS[row.channel_type]) {
    secrets_set[key] = Boolean(row.config[key]);
  }
  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.config)) {
    if (SECRET_KEYS[row.channel_type].includes(key)) {
      config[key] = value ? maskSecret(value) : '';
    } else {
      config[key] = value;
    }
  }
  return {
    id: row.id,
    channel_type: row.channel_type,
    severity_threshold: row.severity_threshold,
    enabled: row.enabled,
    config,
    secrets_set,
  };
}

export async function listAlertChannels(): Promise<AlertChannelPublic[]> {
  const result = await pool.query<AlertChannelRow>(
    `SELECT id, channel_type, severity_threshold, enabled, config, created_at::text
     FROM alert_channels
     WHERE channel_type IN ('telegram', 'email', 'slack')
     ORDER BY channel_type`,
  );
  return result.rows.map((row) =>
    toPublic({
      ...row,
      channel_type: row.channel_type as AlertChannelType,
      config: (row.config ?? {}) as Record<string, string>,
    }),
  );
}

export async function getAlertChannel(type: AlertChannelType): Promise<AlertChannelRow | null> {
  const result = await pool.query<AlertChannelRow>(
    `SELECT id, channel_type, severity_threshold, enabled, config, created_at::text
     FROM alert_channels WHERE channel_type = $1 LIMIT 1`,
    [type],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    channel_type: row.channel_type as AlertChannelType,
    config: (row.config ?? {}) as Record<string, string>,
  };
}

export async function upsertAlertChannel(
  type: AlertChannelType,
  input: {
    severity_threshold?: AlertSeverity;
    enabled?: boolean;
    config: Record<string, string>;
  },
): Promise<AlertChannelPublic> {
  const existing = await getAlertChannel(type);
  const merged: Record<string, string> = { ...(existing?.config ?? {}) };

  for (const [key, value] of Object.entries(input.config)) {
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (SECRET_KEYS[type].includes(key) && (!trimmed || isMaskedSecret(trimmed))) continue;
    if (trimmed) merged[key] = trimmed;
    else if (!SECRET_KEYS[type].includes(key)) merged[key] = '';
  }

  const encrypted = encryptConfig(type, merged);
  const threshold = input.severity_threshold ?? existing?.severity_threshold ?? 'warning';
  const enabled = input.enabled ?? true;

  if (existing) {
    await pool.query(
      `UPDATE alert_channels
       SET severity_threshold = $2, enabled = $3, config = $4
       WHERE id = $1`,
      [existing.id, threshold, enabled, JSON.stringify(encrypted)],
    );
  } else {
    await pool.query(
      `INSERT INTO alert_channels (channel_type, severity_threshold, enabled, config)
       VALUES ($1, $2, $3, $4)`,
      [type, threshold, enabled, JSON.stringify(encrypted)],
    );
  }

  const channels = await listAlertChannels();
  const saved = channels.find((c) => c.channel_type === type);
  if (!saved) throw new Error('Channel save failed');
  return saved;
}

export async function setAlertChannelEnabled(type: AlertChannelType, enabled: boolean): Promise<void> {
  await pool.query(`UPDATE alert_channels SET enabled = $2 WHERE channel_type = $1`, [type, enabled]);
}

export async function loadDispatchChannels(severity: AlertSeverity): Promise<
  Array<{
    id: string;
    channel_type: AlertChannelType;
    severity_threshold: AlertSeverity;
    enabled: boolean;
    config: Record<string, string>;
  }>
> {
  const { SEVERITY_RANK } = await import('../alerts/types.js');
  const result = await pool.query<AlertChannelRow>(
    `SELECT id, channel_type, severity_threshold, enabled, config
     FROM alert_channels
     WHERE enabled = TRUE AND channel_type IN ('telegram', 'email', 'slack')`,
  );
  return result.rows
    .filter((row) => isChannelType(row.channel_type))
    .filter((row) => SEVERITY_RANK[severity] >= SEVERITY_RANK[row.severity_threshold as AlertSeverity])
    .map((row) => {
      const type = row.channel_type as AlertChannelType;
      const raw = (row.config ?? {}) as Record<string, string>;
      return {
        id: row.id,
        channel_type: type,
        severity_threshold: row.severity_threshold as AlertSeverity,
        enabled: row.enabled,
        config: decryptConfig(type, raw),
      };
    });
}

const PLATFORM_DASHBOARD_KEY = 'alert_dashboard_url';

export async function getPlatformDashboardUrl(): Promise<string> {
  return (
    (await getPlatformSetting(PLATFORM_DASHBOARD_KEY)) ||
    process.env.SCOUT_DASHBOARD_URL ||
    'https://console.labyrinthscout.com/dashboard'
  );
}

export async function setPlatformDashboardUrl(url: string): Promise<void> {
  const trimmed = url.trim().replace(/\/+$/, '');
  await setPlatformSetting(PLATFORM_DASHBOARD_KEY, trimmed);
  process.env.SCOUT_DASHBOARD_URL = trimmed;
}
