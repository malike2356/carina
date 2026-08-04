import { pool } from '../db.js';

export type TrustTier = 'standard' | 'enterprise';

export interface AccountTrustSettings {
  tier: TrustTier;
  attestation_interval_days: number;
  verification_interval_days: number;
}

const DEFAULT_SETTINGS: AccountTrustSettings = {
  tier: 'standard',
  attestation_interval_days: 7,
  verification_interval_days: 7,
};

export function normalizeTrustSettings(raw: Partial<AccountTrustSettings> | null): AccountTrustSettings {
  const tier = raw?.tier === 'enterprise' ? 'enterprise' : 'standard';
  const attestation = clampInterval(raw?.attestation_interval_days ?? DEFAULT_SETTINGS.attestation_interval_days);
  const verification = clampInterval(raw?.verification_interval_days ?? DEFAULT_SETTINGS.verification_interval_days);
  return {
    tier,
    attestation_interval_days: attestation,
    verification_interval_days: verification,
  };
}

function clampInterval(days: number): number {
  if (!Number.isFinite(days)) return 7;
  if (days <= 1) return 1;
  if (days >= 7) return 7;
  return Math.round(days);
}

export async function loadAccountTrustSettings(accountId: string): Promise<AccountTrustSettings> {
  const result = await pool.query<{ trust_settings: AccountTrustSettings | null }>(
    `SELECT trust_settings FROM accounts WHERE id = $1 LIMIT 1`,
    [accountId],
  );
  return normalizeTrustSettings(result.rows[0]?.trust_settings ?? null);
}

export async function saveAccountTrustSettings(
  accountId: string,
  settings: AccountTrustSettings,
): Promise<AccountTrustSettings> {
  const normalized = normalizeTrustSettings(settings);
  await pool.query(
    `UPDATE accounts SET trust_settings = $2::jsonb WHERE id = $1`,
    [accountId, JSON.stringify(normalized)],
  );
  return normalized;
}

export async function resolveEnterpriseIntervals(): Promise<{
  attestationDays: number;
  verificationDays: number;
}> {
  const result = await pool.query<{ trust_settings: AccountTrustSettings | null }>(
    `SELECT trust_settings FROM accounts WHERE trust_settings->>'tier' = 'enterprise'`,
  );

  let attestationDays = 7;
  let verificationDays = 7;

  for (const row of result.rows) {
    const settings = normalizeTrustSettings(row.trust_settings);
    attestationDays = Math.min(attestationDays, settings.attestation_interval_days);
    verificationDays = Math.min(verificationDays, settings.verification_interval_days);
  }

  return { attestationDays, verificationDays };
}
