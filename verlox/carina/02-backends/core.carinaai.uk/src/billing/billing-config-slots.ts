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
  { key: 'STRIPE_PRICE_AIVA_STARTER_MONTHLY', label: 'Aiva Starter', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_STARTER_ANNUAL', label: 'Aiva Starter', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_MONTHLY', label: 'Aiva Team', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_TEAM_ANNUAL', label: 'Aiva Team', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_MONTHLY', label: 'Aiva Business', group: 'aiva', interval: 'monthly' },
  { key: 'STRIPE_PRICE_AIVA_BUSINESS_ANNUAL', label: 'Aiva Business', group: 'aiva', interval: 'annual' },
  { key: 'PADDLE_PRICE_AIVA_BUSINESS_MONTHLY', label: 'Aiva Business (Paddle, monthly)', group: 'aiva', interval: 'monthly' },
  { key: 'PADDLE_PRICE_AIVA_BUSINESS_ANNUAL', label: 'Aiva Business (Paddle, annual)', group: 'aiva', interval: 'annual' },
  { key: 'STRIPE_PRICE_AIVA_SEAT_MONTHLY', label: 'Aiva extra AI Employee seat', group: 'aiva', interval: 'monthly' },
  {
    key: 'AIVA_TRIAL_MESSAGE_LIMIT',
    label: 'Free trial managed messages (hard cap)',
    group: 'aiva',
    valueKind: 'text',
    placeholder: '20',
  },
  {
    key: 'AIVA_TRIAL_CREDIT_GBP',
    label: 'Free trial managed credit (£, ledger grant)',
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
    label: 'After free allowance: allow mini LLM CTA (product route pending)',
    group: 'aiva',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'off',
  },
  {
    key: 'CARINA_CLOUD_FREE_DAILY_MESSAGES',
    label: 'Carina hosted free daily messages',
    group: 'carina_ops',
    valueKind: 'text',
    placeholder: '100',
  },
  {
    key: 'CARINA_CLOUD_FREE_DAILY_TOKENS',
    label: 'Carina Cloud free daily tokens (web chat)',
    group: 'carina_ops',
    valueKind: 'text',
    placeholder: '50000',
  },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_5', label: 'Aiva prepaid £5 (quiet top-up)', group: 'aiva' },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_10', label: 'Aiva prepaid £10 (quiet top-up)', group: 'aiva' },
  { key: 'STRIPE_PRICE_AIVA_PREPAID_25', label: 'Aiva prepaid £25 (quiet top-up)', group: 'aiva' },
  { key: 'STRIPE_PRICE_SCOUT_MONITOR', label: 'Scout Monitor', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_SCOUT_GOVERN', label: 'Scout Govern', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_SCOUT_TEAM', label: 'Scout Team', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_ENTERPRISE', label: 'Scout Enterprise', group: 'scout', interval: 'monthly' },
  { key: 'STRIPE_PRICE_CARINA_OPS_STARTER', label: 'Carina Builder', group: 'carina_ops', interval: 'monthly' },
  { key: 'STRIPE_PRICE_CARINA_OPS_TEAM', label: 'Carina Scale', group: 'carina_ops', interval: 'monthly' },
  { key: 'STRIPE_PRICE_TOPUP_SMALL', label: 'Credit top-up (small)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_TOPUP_LARGE', label: 'Credit top-up (large)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_PLATFORM_EVENTS_METERED', label: 'Platform events (metered)', group: 'addons', interval: 'monthly' },
  { key: 'STRIPE_PRICE_MUTANT_BASIC_MONTHLY', label: 'Mutant Basic', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_MUTANT_PRO_MONTHLY', label: 'Mutant Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_PRO_MONTHLY', label: 'Petraclus Pro', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_PRO_ANNUAL', label: 'Petraclus Pro', group: 'keys_server', interval: 'annual', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_TEAM_MONTHLY', label: 'Petraclus Team', group: 'keys_server', interval: 'monthly', keysServerOnly: true },
  { key: 'STRIPE_PRICE_PETRA_TEAM_ANNUAL', label: 'Petraclus Team', group: 'keys_server', interval: 'annual', keysServerOnly: true },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', group: 'integrations', valueKind: 'secret', placeholder: 'sk_live_... or sk_test_...' },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook signing secret', group: 'integrations', valueKind: 'secret', placeholder: 'whsec_...' },
  { key: 'RESEND_API_KEY', label: 'Resend API key (transactional email)', group: 'integrations', valueKind: 'secret', placeholder: 're_...' },
  { key: 'RESEND_WEBHOOK_SECRET', label: 'Resend webhook signing secret', group: 'integrations', valueKind: 'secret', placeholder: 'Optional' },
  { key: 'CF_API_TOKEN', label: 'Cloudflare API token (custom domains)', group: 'integrations', valueKind: 'secret', placeholder: 'CF token' },
  { key: 'CF_FOR_SAAS_ZONE_ID', label: 'Cloudflare zone ID for Aiva SaaS', group: 'integrations', valueKind: 'text', placeholder: 'Zone ID' },
  { key: 'PADDLE_API_KEY', label: 'Paddle API key', group: 'integrations', valueKind: 'secret', placeholder: 'pdl_live_... or pdl_test_...' },
  { key: 'PADDLE_WEBHOOK_SECRET', label: 'Paddle webhook secret', group: 'integrations', valueKind: 'secret', placeholder: 'Webhook signing secret' },
  {
    key: 'PADDLE_ENVIRONMENT',
    label: 'Paddle environment',
    group: 'integrations',
    valueKind: 'enum',
    enumOptions: ['sandbox', 'production'],
    placeholder: 'sandbox',
  },
  {
    key: 'CARINA_SUPPORT_EMAIL',
    label: 'Customer support email',
    group: 'support',
    valueKind: 'text',
    placeholder: 'support@carinaai.uk',
  },
  {
    key: 'AIVA_SUPPORT_INBOX_MONITOR',
    label: 'Support inbox monitor (name or shared inbox)',
    group: 'support',
    valueKind: 'text',
    placeholder: 'Operator name',
  },
  {
    key: 'AIVA_P0_ESCALATION_CONTACT',
    label: 'P0 security escalation contact',
    group: 'support',
    valueKind: 'text',
    placeholder: 'Name, email, or phone',
  },
  {
    key: 'AIVA_APK_LINK_IN_WELCOME',
    label: 'Show Android APK download link in welcome emails',
    group: 'support',
    valueKind: 'enum',
    enumOptions: ['on', 'off'],
    placeholder: 'on',
  },
];

export const BILLING_CONFIG_SLOT_KEYS = BILLING_CONFIG_SLOTS.map((slot) => slot.key);
