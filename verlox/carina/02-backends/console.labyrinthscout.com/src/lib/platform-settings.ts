import { pool } from '../db.js';

export type PlatformSettingSource = 'gui' | 'env';

export interface PlatformSecuritySettings {
  egress_filter_enabled: boolean;
  egress_filter_source: PlatformSettingSource;
  sandbox_enabled: boolean;
  sandbox_source: PlatformSettingSource;
}

const SECURITY_KEYS = {
  egress_filter_enabled: 'security_egress_filter_enabled',
  sandbox_enabled: 'security_sandbox_enabled',
} as const;

export async function getPlatformSetting(key: string): Promise<string | null> {
  const result = await pool.query<{ value: string }>(
    `SELECT value FROM scout_platform_settings WHERE key = $1`,
    [key],
  );
  return result.rows[0]?.value ?? null;
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  await pool.query(
    `INSERT INTO scout_platform_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, trimmed],
  );
}

function parseBooleanSetting(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value.trim().toLowerCase() === 'true';
}

export async function loadPlatformSecuritySettings(): Promise<PlatformSecuritySettings> {
  const [egressSetting, sandboxSetting] = await Promise.all([
    getPlatformSetting(SECURITY_KEYS.egress_filter_enabled),
    getPlatformSetting(SECURITY_KEYS.sandbox_enabled),
  ]);

  return {
    egress_filter_enabled: parseBooleanSetting(
      egressSetting,
      (process.env.SCOUT_EGRESS_FILTER_ENABLED ?? 'false') === 'true',
    ),
    egress_filter_source: egressSetting === null ? 'env' : 'gui',
    sandbox_enabled: parseBooleanSetting(
      sandboxSetting,
      (process.env.SCOUT_SANDBOX_ENABLED ?? 'false') === 'true',
    ),
    sandbox_source: sandboxSetting === null ? 'env' : 'gui',
  };
}

export async function savePlatformSecuritySettings(input: {
  egress_filter_enabled: boolean;
  sandbox_enabled: boolean;
}): Promise<PlatformSecuritySettings> {
  await Promise.all([
    setPlatformSetting(SECURITY_KEYS.egress_filter_enabled, String(input.egress_filter_enabled)),
    setPlatformSetting(SECURITY_KEYS.sandbox_enabled, String(input.sandbox_enabled)),
  ]);
  return loadPlatformSecuritySettings();
}
