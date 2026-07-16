import { query } from './db.js';

export type BillingConfigGroup =
  | 'aiva'
  | 'scout'
  | 'carina_ops'
  | 'addons'
  | 'keys_server'
  | 'integrations'
  | 'support';

export type BillingConfigValueKind = 'stripe_price' | 'paddle_price' | 'secret' | 'text' | 'enum';

export interface BillingConfigSlot {
  key: string;
  label: string;
  group: BillingConfigGroup;
  interval?: 'monthly' | 'annual';
  keysServerOnly?: boolean;
  valueKind?: BillingConfigValueKind;
  enumOptions?: readonly string[];
  placeholder?: string;
}

export const BILLING_CONFIG_GROUP_LABELS: Record<BillingConfigGroup, string> = {
  aiva: 'Aiva',
  scout: 'Scout',
  carina_ops: 'Carina platform',
  addons: 'Add-ons and metered',
  keys_server: 'Separated products (visibility only)',
  integrations: 'Stripe, Paddle, Resend, Cloudflare, and API credentials',
  support: 'Support and launch readiness',
};

export const BILLING_CONFIG_SLOTS: BillingConfigSlot[] = [
  { key: 'STRIPE_PRICE_AIVA_STARTER_MONTHLY', label: 'Aiva Starter', group: 'aiva', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_STARTER_ANNUAL', label: 'Aiva Starter', group: 'aiva', interval: 'annual', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_MONTHLY', label: 'Aiva Team', group: 'aiva', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_ANNUAL', label: 'Aiva Team', group: 'aiva', interval: 'annual', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_MONTHLY', label: 'Aiva Business', group: 'aiva', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_ANNUAL', label: 'Aiva Business', group: 'aiva', interval: 'annual', valueKind: 'stripe_price' },
  { key: 'PADDLE_PRICE_AIVA_BUSINESS_MONTHLY', label: 'Aiva Business (Paddle)', group: 'aiva', interval: 'monthly', valueKind: 'paddle_price' },
  { key: 'PADDLE_PRICE_AIVA_BUSINESS_ANNUAL', label: 'Aiva Business (Paddle)', group: 'aiva', interval: 'annual', valueKind: 'paddle_price' },
  { key: 'STRIPE_PRICE_AIVA_SEAT_MONTHLY', label: 'Aiva extra AI Employee seat', group: 'aiva', interval: 'monthly', valueKind: 'stripe_price' },
  {
    key: 'AIVA_TRIAL_MESSAGE_LIMIT',
    label: 'Free trial managed messages (hard cap)',
    group: 'aiva',
    valueKind: 'text',
    placeholder: '20',
  },
  {
    key: 'AIVA_TRIAL_CREDIT_GBP',
    label: 'Free trial credit shown in UI (£)',
    group: 'aiva',
    valueKind: 'text',
    placeholder: '1',
  },
  {
    key: 'AIVA_TRIAL_DAILY_CAP_GBP',
    label: 'Free trial daily managed spend cap (£)',
    group: 'aiva',
    valueKind: 'text',
    placeholder: '2',
  },
  {
    key: 'AIVA_SOFT_WALL_ALLOW_BYOK',
    label: 'After free allowance: allow BYOK continue',
    group: 'aiva',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'on',
  },
  {
    key: 'AIVA_SOFT_WALL_ALLOW_TOPUP',
    label: 'After free allowance: allow prepaid top-up',
    group: 'aiva',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'on',
  },
  {
    key: 'AIVA_SOFT_WALL_ALLOW_UPGRADE',
    label: 'After free allowance: allow subscribe / upgrade',
    group: 'aiva',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'on',
  },
  {
    key: 'AIVA_SOFT_WALL_ALLOW_MINI_LLM',
    label: 'After free allowance: allow mini LLM CTA',
    group: 'aiva',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'off',
  },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_5', label: 'Aiva prepaid £5 (quiet top-up)', group: 'aiva', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_10', label: 'Aiva prepaid £10 (quiet top-up)', group: 'aiva', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_25', label: 'Aiva prepaid £25 (quiet top-up)', group: 'aiva', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_SCOUT_MONITOR', label: 'Scout Monitor', group: 'scout', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_SCOUT_GOVERN', label: 'Scout Govern', group: 'scout', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_SCOUT_TEAM', label: 'Scout Team', group: 'scout', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_ENTERPRISE', label: 'Scout Enterprise', group: 'scout', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_CARINA_OPS_STARTER', label: 'Carina Builder', group: 'carina_ops', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_CARINA_OPS_TEAM', label: 'Carina Scale', group: 'carina_ops', interval: 'monthly', valueKind: 'stripe_price' },
  {
    key: 'CARINA_CLOUD_FREE_DAILY_MESSAGES',
    label: 'Carina hosted free daily messages',
    group: 'carina_ops',
    valueKind: 'text',
    placeholder: '100',
  },
  {
    key: 'CARINA_CLOUD_FREE_DAILY_TOKENS',
    label: 'Carina Cloud free daily tokens (set on cloud env too)',
    group: 'carina_ops',
    valueKind: 'text',
    placeholder: '50000',
  },
  { key: 'STRIPE_PRICE_TOPUP_SMALL', label: 'Credit top-up (small)', group: 'addons', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_TOPUP_LARGE', label: 'Credit top-up (large)', group: 'addons', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_PLATFORM_EVENTS_METERED', label: 'Platform events (metered)', group: 'addons', interval: 'monthly', valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_MUTANT_BASIC_MONTHLY', label: 'Mutant Basic', group: 'keys_server', interval: 'monthly', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_MUTANT_PRO_MONTHLY', label: 'Mutant Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_PETRA_PRO_MONTHLY', label: 'Petraclus Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_PETRA_PRO_ANNUAL', label: 'Petraclus Pro', group: 'keys_server', interval: 'annual', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_PETRA_TEAM_MONTHLY', label: 'Petraclus Team', group: 'keys_server', interval: 'monthly', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_PRICE_PETRA_TEAM_ANNUAL', label: 'Petraclus Team', group: 'keys_server', interval: 'annual', keysServerOnly: true, valueKind: 'stripe_price' },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', group: 'integrations', valueKind: 'secret', placeholder: 'sk_live_... or sk_test_...' },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook signing secret', group: 'integrations', valueKind: 'secret', placeholder: 'whsec_...' },
  { key: 'RESEND_API_KEY', label: 'Resend API key (transactional email)', group: 'integrations', valueKind: 'secret', placeholder: 're_...' },
  { key: 'RESEND_WEBHOOK_SECRET', label: 'Resend webhook signing secret', group: 'integrations', valueKind: 'secret', placeholder: 'Optional' },
  { key: 'CF_API_TOKEN', label: 'Cloudflare API token (custom domains)', group: 'integrations', valueKind: 'secret', placeholder: 'CF token' },
  { key: 'CF_FOR_SAAS_ZONE_ID', label: 'Cloudflare zone ID for Aiva SaaS', group: 'integrations', valueKind: 'text', placeholder: 'Zone ID' },
  { key: 'PADDLE_API_KEY', label: 'Paddle API key', group: 'integrations', valueKind: 'secret', placeholder: 'pdl_live_... or pdl_test_...' },
  { key: 'PADDLE_WEBHOOK_SECRET', label: 'Paddle webhook secret', group: 'integrations', valueKind: 'secret', placeholder: 'Webhook signing secret' },
  { key: 'PADDLE_ENVIRONMENT', label: 'Paddle environment', group: 'integrations', valueKind: 'enum', enumOptions: ['sandbox', 'production'], placeholder: 'sandbox' },
  { key: 'CARINA_SUPPORT_EMAIL', label: 'Customer support email', group: 'support', valueKind: 'text', placeholder: 'support@carinaai.uk' },
  { key: 'AIVA_SUPPORT_INBOX_MONITOR', label: 'Support inbox monitor', group: 'support', valueKind: 'text', placeholder: 'Operator name or shared inbox' },
  { key: 'AIVA_P0_ESCALATION_CONTACT', label: 'P0 security escalation contact', group: 'support', valueKind: 'text', placeholder: 'Name, email, or phone' },
  {
    key: 'AIVA_APK_LINK_IN_WELCOME',
    label: 'Show Android APK download link in welcome emails',
    group: 'support',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'on',
  },
];

export type BillingConfigRow = {
  key: string;
  label: string;
  group: BillingConfigGroup;
  interval?: 'monthly' | 'annual';
  keysServerOnly?: boolean;
  valueKind: BillingConfigValueKind;
  enumOptions?: readonly string[];
  placeholder?: string;
  value: string;
  envFallback: string;
  effectiveValue: string;
  /** Redacted preview for secret inputs (prefix + bullets). */
  maskedValue: string;
  source: 'database' | 'env' | 'unset';
  updated_by: string | null;
  updated_at: string | null;
};

/** Show a short prefix plus bullets so operators can see a key is configured. */
export function maskSecretValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const prefixLen = Math.min(8, Math.max(3, Math.ceil(trimmed.length * 0.18)));
  return `${trimmed.slice(0, prefixLen)}${'*'.repeat(12)}`;
}

/** True when the form was saved without changing an existing secret (redacted display resubmitted). */
export function isUnchangedSecretSubmission(submitted: string, existing: string): boolean {
  const next = submitted.trim();
  const current = existing.trim();
  if (!next || !current) return false;
  if (next === current) return true;
  if (next === maskSecretValue(current)) return true;
  if (/^[•*]{8,}$/.test(next)) return true;
  if (/^[A-Za-z0-9_]{2,10}[•*]+$/.test(next)) return true;
  return false;
}

function inferValueKind(slot: BillingConfigSlot): BillingConfigValueKind {
  if (slot.valueKind) return slot.valueKind;
  if (slot.key.startsWith('PADDLE_PRICE_')) return 'paddle_price';
  if (slot.key.startsWith('STRIPE_PRICE_')) return 'stripe_price';
  return 'text';
}

function validateConfigValue(slot: BillingConfigSlot, value: string): void {
  if (!value) return;
  const kind = inferValueKind(slot);
  if (kind === 'stripe_price' && !/^price_[A-Za-z0-9]+$/.test(value)) {
    throw new Error('Stripe price IDs must start with price_');
  }
  if (kind === 'paddle_price' && !/^pri_[A-Za-z0-9]+$/.test(value)) {
    throw new Error('Paddle price IDs must start with pri_');
  }
  if (kind === 'enum' && slot.enumOptions && !slot.enumOptions.includes(value)) {
    throw new Error(`Must be one of: ${slot.enumOptions.join(', ')}`);
  }
  if (slot.key === 'AIVA_TRIAL_MESSAGE_LIMIT') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 10_000 || !Number.isInteger(n)) {
      throw new Error('Trial message limit must be a whole number from 1 to 10000');
    }
  }
  if (slot.key === 'AIVA_TRIAL_CREDIT_GBP') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error('Trial credit GBP must be a number from 0 to 100');
    }
  }
  if (slot.key === 'AIVA_TRIAL_DAILY_CAP_GBP') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error('Trial daily cap GBP must be a number from 0 to 100');
    }
  }
  if (
    slot.key === 'CARINA_CLOUD_FREE_DAILY_MESSAGES'
    || slot.key === 'CARINA_CLOUD_FREE_DAILY_TOKENS'
  ) {
    const n = Number(value);
    const max = slot.key === 'CARINA_CLOUD_FREE_DAILY_TOKENS' ? 10_000_000 : 100_000;
    const min = slot.key === 'CARINA_CLOUD_FREE_DAILY_TOKENS' ? 1_000 : 1;
    if (!Number.isFinite(n) || n < min || n > max || !Number.isInteger(n)) {
      throw new Error(`${slot.key} must be a whole number from ${min} to ${max}`);
    }
  }
  if (kind === 'secret' && slot.key === 'STRIPE_SECRET_KEY' && !/^sk_(live|test)_/.test(value)) {
    throw new Error('Stripe secret keys must start with sk_live_ or sk_test_');
  }
  if (kind === 'secret' && slot.key === 'STRIPE_WEBHOOK_SECRET' && !/^whsec_/.test(value)) {
    throw new Error('Stripe webhook secrets must start with whsec_');
  }
  if (kind === 'secret' && slot.key === 'RESEND_API_KEY' && !/^re_/.test(value)) {
    throw new Error('Resend API keys must start with re_');
  }
  if (value.length > 500) {
    throw new Error('Value too long (max 500 characters)');
  }
}

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
    const valueKind = inferValueKind(slot);

    const maskedValue =
      valueKind === 'secret' && effectiveValue ? maskSecretValue(effectiveValue) : '';

    return {
      ...slot,
      valueKind,
      value: dbValue,
      envFallback,
      effectiveValue,
      maskedValue,
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
  validateConfigValue(slot, trimmed);

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

const SLOT_KEY_SET = new Set(BILLING_CONFIG_SLOTS.map((slot) => slot.key));

export function parseCredentialBundle(raw: string): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!SLOT_KEY_SET.has(key) || !value) continue;
    entries.push({ key, value });
  }
  return entries;
}

export async function bulkUpsertBillingConfig(
  entries: Array<{ key: string; value: string }>,
  updatedBy: string | null,
): Promise<{ saved: string[]; skipped: string[] }> {
  const saved: string[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    try {
      await upsertBillingConfig(entry.key, entry.value, updatedBy);
      saved.push(entry.key);
    } catch {
      skipped.push(entry.key);
    }
  }
  return { saved, skipped };
}
