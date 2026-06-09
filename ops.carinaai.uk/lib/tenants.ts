import { query } from './db.js';

export interface TenantSummary {
  total: number;
  freeCount: number;
  proCount: number;
  messagesToday: number;
  monthlyTokens: number;
}

export interface TenantRow {
  id: string;
  email: string;
  tier: string;
  messagesToday: number;
  messagesDay: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  providerCount: number;
  monthlyTokens: number;
  monthlyCost: number;
}

export interface TenantDetail extends TenantRow {
  apiKeyMasked: string;
  schemaName: string;
  providers: Array<{ provider: string; enabled: boolean }>;
  recentUsage: Array<{
    date: string;
    tokensUsed: number;
    model: string;
    costEstimate: number;
  }>;
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

export async function hostedTablesReady(): Promise<boolean> {
  return tableExists('hosted_users');
}

export async function fetchTenantSummary(): Promise<TenantSummary | null> {
  if (!(await hostedTablesReady())) return null;

  const users = await query<{
    total: string;
    free_count: string;
    pro_count: string;
    messages_today: string;
  }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE tier = 'free')::text AS free_count,
            COUNT(*) FILTER (WHERE tier = 'pro')::text AS pro_count,
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
    messagesToday: Number(row?.messages_today ?? 0),
    monthlyTokens,
  };
}

export async function fetchTenants(): Promise<TenantRow[]> {
  if (!(await hostedTablesReady())) return [];

  const hasProviders = await tableExists('tenant_provider_keys');
  const hasUsage = await tableExists('usage_records');

  const providerJoin = hasProviders
    ? `LEFT JOIN (
         SELECT tenant_id, COUNT(*)::int AS provider_count
         FROM tenant_provider_keys
         GROUP BY tenant_id
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

  const result = await query<{
    id: string;
    email: string;
    tier: string;
    messages_today: number;
    messages_day: string | null;
    stripe_customer_id: string | null;
    created_at: Date;
    subscription_plan: string | null;
    subscription_status: string | null;
    provider_count: number;
    monthly_tokens: string;
    monthly_cost: string;
  }>(
    `SELECT u.id, u.email, u.tier, u.messages_today, u.messages_day::text,
            u.stripe_customer_id, u.created_at,
            s.plan AS subscription_plan, s.status AS subscription_status,
            ${providerSelect}::int AS provider_count,
            ${monthlyTokensSelect}::bigint AS monthly_tokens,
            ${monthlyCostSelect}::numeric AS monthly_cost
     FROM hosted_users u
     LEFT JOIN subscriptions s ON s.tenant_id = u.id
     ${providerJoin}
     ${usageJoin}
     ORDER BY u.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    tier: row.tier,
    messagesToday: row.messages_today,
    messagesDay: row.messages_day,
    stripeCustomerId: row.stripe_customer_id,
    createdAt: row.created_at,
    subscriptionPlan: row.subscription_plan,
    subscriptionStatus: row.subscription_status,
    providerCount: row.provider_count,
    monthlyTokens: Number(row.monthly_tokens),
    monthlyCost: Number(row.monthly_cost),
  }));
}

export async function fetchTenantById(id: string): Promise<TenantDetail | null> {
  const tenants = await fetchTenants();
  const base = tenants.find((t) => t.id === id);
  if (!base) return null;

  const user = await query<{
    api_key: string;
    schema_name: string;
  }>(
    'SELECT api_key, schema_name FROM hosted_users WHERE id = $1',
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
       FROM usage_records
       WHERE tenant_id = $1
       ORDER BY date DESC, created_at DESC
       LIMIT 30`,
      [id],
    );
    recentUsage = usage.rows.map((r) => ({
      date: r.date,
      tokensUsed: r.tokens_used,
      model: r.model,
      costEstimate: Number(r.cost_estimate),
    }));
  }

  const row = user.rows[0];
  return {
    ...base,
    apiKeyMasked: maskApiKey(row.api_key),
    schemaName: row.schema_name,
    providers,
    recentUsage,
  };
}

export async function setTenantTier(id: string, tier: 'free' | 'pro'): Promise<boolean> {
  const result = await query(
    `UPDATE hosted_users SET tier = $1 WHERE id = $2`,
    [tier, id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function resetTenantDailyQuota(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE hosted_users
     SET messages_today = 0, messages_day = CURRENT_DATE
     WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
