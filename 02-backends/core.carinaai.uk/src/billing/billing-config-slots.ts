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

export const BILLING_CONFIG_SLOT_KEYS = BILLING_CONFIG_SLOTS.map((slot) => slot.key);
