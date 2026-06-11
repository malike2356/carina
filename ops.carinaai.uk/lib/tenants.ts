import { pool, query } from './db.js';
import { runHostedMigrations } from './hosted-migrations.js';
import {
  BILLING_PLANS,
  formatTokenLimit,
  normalizePlanId,
  type BillingPlanId,
} from './billing-plans.js';
import { logAudit } from './tenant-audit.js';
import type { AccessStatus, ProvisioningType } from './tenant-provisioning.js';

export interface TenantSummary {
  total: number;
  freeCount: number;
  proCount: number;
  manualCount: number;
  saasCount: number;
  suspendedCount: number;
  messagesToday: number;
  monthlyTokens: number;
}

export interface TenantRow {
  id: string;
  email: string;
  displayName: string | null;
  companyName: string | null;
  tier: string;
  provisioningType: ProvisioningType;
  accessStatus: AccessStatus;
  messagesToday: number;
  messagesDay: string | null;
  dailyMessageLimit: number | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  provisioningSource: string | null;
  providerCount: number;
  monthlyTokens: number;
  monthlyCost: number;
  packCount: number;
}

export interface TenantInvoice {
  id: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  failureReason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}

export interface TenantSubscription {
  plan: BillingPlanId;
  status: string;
  provisioningSource: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  cancelledAt: Date | null;
  scoutApiKeyMasked: string | null;
}

export interface UsageSummary {
  tokensUsed: number;
  tokenLimit: number | null;
  tokenLimitLabel: string;
  costEstimate: number;
  messagesToday: number;
  dailyLimit: number | null;
  byModel: Array<{ model: string; tokens: number; cost: number }>;
  byDate: Array<{ date: string; tokens: number; cost: number }>;
  hasData: boolean;
}

export interface TenantDetail extends TenantRow {
  apiKeyMasked: string;
  schemaName: string;
  notes: string | null;
  providers: Array<{ provider: string; enabled: boolean }>;
  recentUsage: Array<{
    date: string;
    tokensUsed: number;
    model: string;
    costEstimate: number;
  }>;
  subscription: TenantSubscription | null;
  invoices: TenantInvoice[];
  installedPacks: string[];
  usageSummary: UsageSummary;
}

export interface SubscriptionListRow {
  tenantId: string;
  email: string;
  displayName: string | null;
  plan: BillingPlanId;
  status: string;
  provisioningSource: string;
  provisioningType: ProvisioningType;
  accessStatus: AccessStatus;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  updatedAt: Date | null;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '***';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

async function tableExists(name: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name],
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function hostedTablesReady(): Promise<boolean> {
  return tableExists('hosted_users');
}

export async function ensureHostedSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await runHostedMigrations(client);
  } finally {
    client.release();
  }
}

function rowProvisioningType(value: unknown): ProvisioningType {
  if (value === 'manual' || value === 'trial') return value;
  return 'saas';
}

function rowAccessStatus(value: unknown): AccessStatus {
  if (value === 'suspended' || value === 'trial') return value;
  return 'active';
}

export async function fetchTenantSummary(): Promise<TenantSummary | null> {
  if (!(await hostedTablesReady())) return null;

  const hasAdminCols = await columnExists('hosted_users', 'provisioning_type');

  const users = await query<{
    total: string;
    free_count: string;
    pro_count: string;
    manual_count: string;
    saas_count: string;
    suspended_count: string;
    messages_today: string;
  }>(
    hasAdminCols
      ? `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE tier = 'free')::text AS free_count,
                COUNT(*) FILTER (WHERE tier = 'pro')::text AS pro_count,
                COUNT(*) FILTER (WHERE provisioning_type = 'manual')::text AS manual_count,
                COUNT(*) FILTER (WHERE provisioning_type = 'saas')::text AS saas_count,
                COUNT(*) FILTER (WHERE access_status = 'suspended')::text AS suspended_count,
                COALESCE(SUM(messages_today), 0)::text AS messages_today
         FROM hosted_users`
      : `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE tier = 'free')::text AS free_count,
                COUNT(*) FILTER (WHERE tier = 'pro')::text AS pro_count,
                0::text AS manual_count,
                COUNT(*)::text AS saas_count,
                0::text AS suspended_count,
                COALESCE(SUM(messages_today), 0)::text AS messages_today
         FROM hosted_users`,
  );

  let monthlyTokens = 0;
  if (await tableExists('usage_records')) {
    const usage = await query<{ tokens: string }>(
      `SELECT COALESCE(SUM(tokens_used), 0)::text AS tokens
       FROM usage_records
       WHERE date >= date_trunc('month', CURRENT_DATE)::date`,
    );
    monthlyTokens = Number(usage.rows[0]?.tokens ?? 0);
  }

  const row = users.rows[0];
  return {
    total: Number(row?.total ?? 0),
    freeCount: Number(row?.free_count ?? 0),
    proCount: Number(row?.pro_count ?? 0),
    manualCount: Number(row?.manual_count ?? 0),
    saasCount: Number(row?.saas_count ?? 0),
    suspendedCount: Number(row?.suspended_count ?? 0),
    messagesToday: Number(row?.messages_today ?? 0),
    monthlyTokens,
  };
}

export async function fetchTenants(filters?: {
  tier?: string;
  provisioningType?: string;
  accessStatus?: string;
}): Promise<TenantRow[]> {
  if (!(await hostedTablesReady())) return [];

  const hasProviders = await tableExists('tenant_provider_keys');
  const hasUsage = await tableExists('usage_records');
  const hasPacks = await tableExists('installed_packs');
  const hasAdminCols = await columnExists('hosted_users', 'provisioning_type');
  const hasSubSource = await columnExists('subscriptions', 'provisioning_source');

  const providerJoin = hasProviders
    ? `LEFT JOIN (
         SELECT tenant_id, COUNT(*)::int AS provider_count
         FROM tenant_provider_keys GROUP BY tenant_id
       ) pk ON pk.tenant_id = u.id`
    : '';
  const providerSelect = hasProviders ? 'COALESCE(pk.provider_count, 0)' : '0';

  const usageJoin = hasUsage
    ? `LEFT JOIN (
         SELECT tenant_id,
                SUM(tokens_used)::bigint AS monthly_tokens,
                SUM(cost_estimate)::numeric AS monthly_cost
         FROM usage_records
         WHERE date >= date_trunc('month', CURRENT_DATE)::date
         GROUP BY tenant_id
       ) usage ON usage.tenant_id = u.id`
    : '';
  const monthlyTokensSelect = hasUsage ? 'COALESCE(usage.monthly_tokens, 0)' : '0';
  const monthlyCostSelect = hasUsage ? 'COALESCE(usage.monthly_cost, 0)' : '0';

  const packsJoin = hasPacks
    ? `LEFT JOIN (
         SELECT tenant_id, COUNT(*)::int AS pack_count
         FROM installed_packs WHERE status = 'installed'
         GROUP BY tenant_id
       ) packs ON packs.tenant_id = u.id::text`
    : '';
  const packCountSelect = hasPacks ? 'COALESCE(packs.pack_count, 0)' : '0';

  const displaySelect = hasAdminCols ? 'u.display_name, u.company_name' : 'NULL::text AS display_name, NULL::text AS company_name';
  const provisioningSelect = hasAdminCols ? 'u.provisioning_type, u.access_status' : `'saas' AS provisioning_type, 'active' AS access_status`;
  const updatedSelect = hasAdminCols ? 'u.updated_at' : 'NULL::timestamptz AS updated_at';
  const dailyLimitSelect = hasAdminCols ? 'u.daily_message_limit' : 'NULL::integer AS daily_message_limit';
  const subSourceSelect = hasSubSource ? 's.provisioning_source' : `'saas' AS provisioning_source`;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters?.tier) {
    params.push(filters.tier);
    conditions.push(`u.tier = $${params.length}`);
  }
  if (filters?.provisioningType && hasAdminCols) {
    params.push(filters.provisioningType);
    conditions.push(`u.provisioning_type = $${params.length}`);
  }
  if (filters?.accessStatus && hasAdminCols) {
    params.push(filters.accessStatus);
    conditions.push(`u.access_status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<{
    id: string;
    email: string;
    display_name: string | null;
    company_name: string | null;
    tier: string;
    provisioning_type: string;
    access_status: string;
    messages_today: number;
    messages_day: string | null;
    daily_message_limit: number | null;
    stripe_customer_id: string | null;
    created_at: Date;
    updated_at: Date | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    provisioning_source: string | null;
    provider_count: number;
    monthly_tokens: string;
    monthly_cost: string;
    pack_count: number;
  }>(
    `SELECT u.id, u.email, ${displaySelect}, u.tier, ${provisioningSelect},
            u.messages_today, u.messages_day::text, ${dailyLimitSelect},
            u.stripe_customer_id, u.created_at, ${updatedSelect},
            s.plan AS subscription_plan, s.status AS subscription_status,
            ${subSourceSelect},
            ${providerSelect}::int AS provider_count,
            ${monthlyTokensSelect}::bigint AS monthly_tokens,
            ${monthlyCostSelect}::numeric AS monthly_cost,
            ${packCountSelect}::int AS pack_count
     FROM hosted_users u
     LEFT JOIN subscriptions s ON s.tenant_id = u.id
     ${providerJoin}
     ${usageJoin}
     ${packsJoin}
     ${where}
     ORDER BY u.created_at DESC`,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    companyName: row.company_name,
    tier: row.tier,
    provisioningType: rowProvisioningType(row.provisioning_type),
    accessStatus: rowAccessStatus(row.access_status),
    messagesToday: row.messages_today,
    messagesDay: row.messages_day,
    dailyMessageLimit: row.daily_message_limit,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subscriptionPlan: row.subscription_plan,
    subscriptionStatus: row.subscription_status,
    provisioningSource: row.provisioning_source,
    providerCount: row.provider_count,
    monthlyTokens: Number(row.monthly_tokens),
    monthlyCost: Number(row.monthly_cost),
    packCount: row.pack_count,
  }));
}

async function fetchUsageSummary(tenantId: string, plan: BillingPlanId): Promise<UsageSummary> {
  const freeDailyLimit = Number(process.env.HOSTED_FREE_DAILY_MESSAGES ?? 100);
  const tokenLimit = BILLING_PLANS[plan].tokenLimit;

  const userRow = await query<{
    messages_today: number;
    daily_message_limit: number | null;
    tier: string;
  }>(
    `SELECT messages_today, daily_message_limit, tier FROM hosted_users WHERE id = $1`,
    [tenantId],
  );
  const user = userRow.rows[0];
  const dailyLimit = user?.daily_message_limit
    ?? (user?.tier === 'free' ? freeDailyLimit : null);

  if (!(await tableExists('usage_records'))) {
    return {
      tokensUsed: 0,
      tokenLimit,
      tokenLimitLabel: formatTokenLimit(tokenLimit),
      costEstimate: 0,
      messagesToday: user?.messages_today ?? 0,
      dailyLimit,
      byModel: [],
      byDate: [],
      hasData: false,
    };
  }

  const monthly = await query<{ tokens: string; cost: string }>(
    `SELECT COALESCE(SUM(tokens_used), 0)::text AS tokens,
            COALESCE(SUM(cost_estimate), 0)::text AS cost
     FROM usage_records
     WHERE tenant_id = $1
       AND date >= date_trunc('month', CURRENT_DATE)::date`,
    [tenantId],
  );

  const byModel = await query<{ model: string; tokens: string; cost: string }>(
    `SELECT model,
            SUM(tokens_used)::text AS tokens,
            SUM(cost_estimate)::text AS cost
     FROM usage_records
     WHERE tenant_id = $1
       AND date >= date_trunc('month', CURRENT_DATE)::date
     GROUP BY model
     ORDER BY SUM(tokens_used) DESC`,
    [tenantId],
  );

  const byDate = await query<{ date: string; tokens: string; cost: string }>(
    `SELECT date::text,
            SUM(tokens_used)::text AS tokens,
            SUM(cost_estimate)::text AS cost
     FROM usage_records
     WHERE tenant_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY date
     ORDER BY date DESC`,
    [tenantId],
  );

  const tokensUsed = Number(monthly.rows[0]?.tokens ?? 0);
  const costEstimate = Number(monthly.rows[0]?.cost ?? 0);

  return {
    tokensUsed,
    tokenLimit,
    tokenLimitLabel: formatTokenLimit(tokenLimit),
    costEstimate,
    messagesToday: user?.messages_today ?? 0,
    dailyLimit,
    byModel: byModel.rows.map((r) => ({
      model: r.model,
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    })),
    byDate: byDate.rows.map((r) => ({
      date: r.date,
      tokens: Number(r.tokens),
      cost: Number(r.cost),
    })),
    hasData: tokensUsed > 0 || byDate.rows.length > 0,
  };
}

async function fetchInvoices(tenantId: string): Promise<TenantInvoice[]> {
  if (!(await tableExists('invoices'))) return [];
  const hasFailure = await columnExists('invoices', 'failure_reason');
  const hasCurrency = await columnExists('invoices', 'currency');

  const result = await query<{
    id: string;
    stripe_invoice_id: string;
    amount: number;
    currency: string | null;
    status: string;
    pdf_url: string | null;
    failure_reason: string | null;
    period_start: Date | null;
    period_end: Date | null;
    created_at: Date;
  }>(
    `SELECT id, stripe_invoice_id, amount,
            ${hasCurrency ? 'currency' : `'gbp' AS currency`},
            status, pdf_url,
            ${hasFailure ? 'failure_reason' : 'NULL::text AS failure_reason'},
            period_start, period_end, created_at
     FROM invoices
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [tenantId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    stripeInvoiceId: row.stripe_invoice_id,
    amount: row.amount,
    currency: row.currency ?? 'gbp',
    status: row.status,
    pdfUrl: row.pdf_url,
    failureReason: row.failure_reason,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
  }));
}

async function fetchSubscription(tenantId: string): Promise<TenantSubscription | null> {
  if (!(await tableExists('subscriptions'))) return null;
  const hasSource = await columnExists('subscriptions', 'provisioning_source');
  const hasTrial = await columnExists('subscriptions', 'trial_ends_at');
  const hasCancelled = await columnExists('subscriptions', 'cancelled_at');

  const result = await query<{
    plan: string;
    status: string;
    provisioning_source: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    trial_ends_at: Date | null;
    cancelled_at: Date | null;
    scout_api_key: string | null;
  }>(
    `SELECT plan, status,
            ${hasSource ? 'provisioning_source' : `'saas' AS provisioning_source`},
            stripe_customer_id, stripe_subscription_id,
            current_period_start, current_period_end,
            ${hasTrial ? 'trial_ends_at' : 'NULL::timestamptz AS trial_ends_at'},
            ${hasCancelled ? 'cancelled_at' : 'NULL::timestamptz AS cancelled_at'},
            scout_api_key
     FROM subscriptions WHERE tenant_id = $1`,
    [tenantId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    plan: normalizePlanId(row.plan),
    status: row.status,
    provisioningSource: row.provisioning_source ?? 'saas',
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
    cancelledAt: row.cancelled_at,
    scoutApiKeyMasked: row.scout_api_key ? maskApiKey(row.scout_api_key) : null,
  };
}

export async function fetchTenantById(id: string): Promise<TenantDetail | null> {
  const tenants = await fetchTenants();
  const base = tenants.find((t) => t.id === id);
  if (!base) return null;

  const hasNotes = await columnExists('hosted_users', 'notes');
  const user = await query<{
    api_key: string;
    schema_name: string;
    notes: string | null;
  }>(
    hasNotes
      ? 'SELECT api_key, schema_name, notes FROM hosted_users WHERE id = $1'
      : 'SELECT api_key, schema_name, NULL::text AS notes FROM hosted_users WHERE id = $1',
    [id],
  );
  if (user.rowCount === 0) return null;

  let providers: TenantDetail['providers'] = [];
  if (await tableExists('tenant_provider_keys')) {
    const pk = await query<{ provider: string; enabled: boolean }>(
      `SELECT provider, enabled FROM tenant_provider_keys WHERE tenant_id = $1 ORDER BY provider`,
      [id],
    );
    providers = pk.rows;
  }

  let recentUsage: TenantDetail['recentUsage'] = [];
  if (await tableExists('usage_records')) {
    const usage = await query<{
      date: string;
      tokens_used: number;
      model: string;
      cost_estimate: string;
    }>(
      `SELECT date::text, tokens_used, model, cost_estimate::text
       FROM usage_records WHERE tenant_id = $1
       ORDER BY date DESC, created_at DESC LIMIT 30`,
      [id],
    );
    recentUsage = usage.rows.map((r) => ({
      date: r.date,
      tokensUsed: r.tokens_used,
      model: r.model,
      costEstimate: Number(r.cost_estimate),
    }));
  }

  const subscription = await fetchSubscription(id);
  const plan = subscription?.plan ?? normalizePlanId(base.subscriptionPlan);
  const usageSummary = await fetchUsageSummary(id, plan);
  const invoices = await fetchInvoices(id);

  let installedPacks: string[] = [];
  if (await tableExists('installed_packs')) {
    const packs = await query<{ pack_name: string }>(
      `SELECT pack_name FROM installed_packs
       WHERE tenant_id = $1 AND status = 'installed' ORDER BY pack_name`,
      [id],
    );
    installedPacks = packs.rows.map((r) => r.pack_name);
  }

  const row = user.rows[0];
  return {
    ...base,
    apiKeyMasked: maskApiKey(row.api_key),
    schemaName: row.schema_name,
    notes: row.notes,
    providers,
    recentUsage,
    subscription,
    invoices,
    installedPacks,
    usageSummary,
  };
}

export async function fetchAllSubscriptions(): Promise<SubscriptionListRow[]> {
  if (!(await tableExists('subscriptions'))) return [];
  const hasAdminCols = await columnExists('hosted_users', 'provisioning_type');
  const hasSubSource = await columnExists('subscriptions', 'provisioning_source');

  const result = await query<{
    tenant_id: string;
    email: string;
    display_name: string | null;
    plan: string;
    status: string;
    provisioning_source: string | null;
    provisioning_type: string;
    access_status: string;
    stripe_subscription_id: string | null;
    current_period_end: Date | null;
    updated_at: Date | null;
  }>(
    `SELECT s.tenant_id, u.email,
            ${hasAdminCols ? 'u.display_name' : 'NULL::text AS display_name'},
            s.plan, s.status,
            ${hasSubSource ? 's.provisioning_source' : `'saas' AS provisioning_source`},
            ${hasAdminCols ? 'u.provisioning_type, u.access_status' : `'saas' AS provisioning_type, 'active' AS access_status`},
            s.stripe_subscription_id, s.current_period_end, s.updated_at
     FROM subscriptions s
     JOIN hosted_users u ON u.id = s.tenant_id
     ORDER BY s.updated_at DESC NULLS LAST, u.created_at DESC`,
  );

  return result.rows.map((row) => ({
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    plan: normalizePlanId(row.plan),
    status: row.status,
    provisioningSource: row.provisioning_source ?? 'saas',
    provisioningType: rowProvisioningType(row.provisioning_type),
    accessStatus: rowAccessStatus(row.access_status),
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end,
    updatedAt: row.updated_at,
  }));
}

export async function setTenantTier(id: string, tier: 'free' | 'pro'): Promise<boolean> {
  const result = await query(
    `UPDATE hosted_users SET tier = $1, updated_at = NOW() WHERE id = $2`,
    [tier, id],
  );
  if ((result.rowCount ?? 0) > 0) {
    await logAudit('tier_changed', { tier }, id);
  }
  return (result.rowCount ?? 0) > 0;
}

export async function resetTenantDailyQuota(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE hosted_users
     SET messages_today = 0, messages_day = CURRENT_DATE, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
  if ((result.rowCount ?? 0) > 0) {
    await logAudit('quota_reset', {}, id);
  }
  return (result.rowCount ?? 0) > 0;
}

export function tenantDisplayName(tenant: Pick<TenantRow, 'displayName' | 'companyName' | 'email'>): string {
  return tenant.displayName || tenant.companyName || tenant.email;
}

export function provisioningLabel(type: ProvisioningType, source: string | null): string {
  if (type === 'manual' || source === 'manual') return 'Manual/direct';
  if (type === 'trial') return 'Trial';
  return 'SaaS subscription';
}
