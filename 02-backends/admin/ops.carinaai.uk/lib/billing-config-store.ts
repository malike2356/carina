import { query } from './db.js';

export type BillingConfigGroup = 'aiva' | 'scout' | 'carina_ops' | 'addons' | 'keys_server';

export interface BillingConfigSlot {
  key: string;
  label: string;
  group: BillingConfigGroup;
  interval?: 'monthly' | 'annual';
  keysServerOnly?: boolean;
}

export const BILLING_CONFIG_GROUP_LABELS: Record<BillingConfigGroup, string> = {
  aiva: 'Aiva',
  scout: 'Scout',
  carina_ops: 'Carina Ops',
  addons: 'Add-ons and metered',
  keys_server: 'Keys server (Mutant / Petraclus)',
};

export const BILLING_CONFIG_SLOTS: BillingConfigSlot[] = [
  { key: 'STRIPE_PRICE_AIVA_STARTER_MONTHLY', label: 'Aiva Starter', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_STARTER_ANNUAL', label: 'Aiva Starter', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_GROWTH_MONTHLY', label: 'Aiva Growth (legacy env name)', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_GROWTH_ANNUAL', label: 'Aiva Growth (legacy env name)', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_MONTHLY', label: 'Aiva Team / Growth', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_ANNUAL', label: 'Aiva Team / Growth', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_MONTHLY', label: 'Aiva Business', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_ANNUAL', label: 'Aiva Business', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_SEAT_MONTHLY', label: 'Aiva extra AI Employee seat', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_SCOUT_MONITOR', label: 'Scout Monitor', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_SCOUT_GOVERN', label: 'Scout Govern', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_CARINA_OPS_STARTER', label: 'Carina Ops Starter', group: 'carina_ops', interval: 'monthly' },
  { key: 'STRIPE_PRICE_CARINA_OPS_TEAM', label: 'Carina Ops Team', group: 'carina_ops', interval: 'monthly' },
  { key: 'STRIPE_PRICE_ENTERPRISE', label: 'Enterprise', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_TOPUP_SMALL', label: 'Credit top-up (small)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_TOPUP_LARGE', label: 'Credit top-up (large)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_PLATFORM_EVENTS_METERED', label: 'Platform events (metered)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_MUTANT_BASIC_MONTHLY', label: 'Mutant Basic', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_MUTANT_PRO_MONTHLY', label: 'Mutant Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_PRO_MONTHLY', label: 'Petraclus Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_PRO_ANNUAL', label: 'Petraclus Pro', group: 'keys_server', interval: 'annual', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_TEAM_MONTHLY', label: 'Petraclus Team', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_TEAM_ANNUAL', label: 'Petraclus Team', group: 'keys_server', interval: 'annual', keysServerOnly: true },
];

export type BillingConfigRow = {
  key: string;
  label: string;
  group: BillingConfigGroup;
  interval?: 'monthly' | 'annual';
  keysServerOnly?: boolean;
  value: string;
  envFallback: string;
  effectiveValue: string;
  source: 'database' | 'env' | 'unset';
  updated_by: string | null;
  updated_at: string | null;
};

export async function ensureBillingConfigTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS billing_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function envValue(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function isValidStripePriceId(value: string): boolean {
  if (!value) return true;
  return /^price_[A-Za-z0-9]+$/.test(value);
}

export async function listBillingConfig(): Promise<BillingConfigRow[]> {
  const dbResult = await query<{
    key: string;
    value: string;
    updated_by: string | null;
    updated_at: string;
  }>(
    `SELECT key, value, updated_by, updated_at::text AS updated_at FROM billing_config`,
  );
  const byKey = new Map(dbResult.rows.map((row) => [row.key, row]));

  return BILLING_CONFIG_SLOTS.map((slot) => {
    const stored = byKey.get(slot.key);
    const dbValue = stored?.value?.trim() ?? '';
    const envFallback = envValue(slot.key);
    const effectiveValue = dbValue || envFallback;
    let source: BillingConfigRow['source'] = 'unset';
    if (dbValue) source = 'database';
    else if (envFallback) source = 'env';

    return {
      ...slot,
      value: dbValue,
      envFallback,
      effectiveValue,
      source,
      updated_by: stored?.updated_by ?? null,
      updated_at: stored?.updated_at ?? null,
    };
  });
}

export async function upsertBillingConfig(
  key: string,
  value: string,
  updatedBy: string | null,
): Promise<void> {
  const slot = BILLING_CONFIG_SLOTS.find((row) => row.key === key);
  if (!slot) throw new Error(`Unknown billing config key: ${key}`);

  const trimmed = value.trim();
  if (trimmed && !isValidStripePriceId(trimmed)) {
    throw new Error('Stripe price IDs must start with price_');
  }

  if (!trimmed) {
    await query('DELETE FROM billing_config WHERE key = $1', [key]);
    return;
  }

  await query(
    `INSERT INTO billing_config (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, trimmed, updatedBy],
  );
}

export function groupRows(rows: BillingConfigRow[]): Record<BillingConfigGroup, BillingConfigRow[]> {
  const grouped = {} as Record<BillingConfigGroup, BillingConfigRow[]>;
  for (const group of Object.keys(BILLING_CONFIG_GROUP_LABELS) as BillingConfigGroup[]) {
    grouped[group] = rows.filter((row) => row.group === group);
  }
  return grouped;
}
