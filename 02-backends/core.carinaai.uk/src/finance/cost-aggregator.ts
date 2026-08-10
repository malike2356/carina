/**
 * Infrastructure / AI cost collection and per-user attribution.
 */

import {
  listCostsInRange,
  monthDateRange,
  newFinanceId,
  replaceMonthCosts,
  type CostRow,
  type CostService,
} from './finance-store.js';

export type DateRange = { from: string; to: string };

export type ProviderCostFetch = (range: DateRange) => Promise<
  Array<{
    date: string;
    userId?: string;
    workspaceId?: string;
    feature?: string;
    amountMinor: number;
    currency?: string;
    service: CostService;
  }>
>;

let aiFetcher: ProviderCostFetch | null = null;
let hostingFetcher: ProviderCostFetch | null = null;
let thirdPartyFetcher: ProviderCostFetch | null = null;

export function setCostFetchers(opts: {
  ai?: ProviderCostFetch | null;
  hosting?: ProviderCostFetch | null;
  thirdParty?: ProviderCostFetch | null;
}): void {
  if ('ai' in opts) aiFetcher = opts.ai ?? null;
  if ('hosting' in opts) hostingFetcher = opts.hosting ?? null;
  if ('thirdParty' in opts) thirdPartyFetcher = opts.thirdParty ?? null;
}

async function defaultCollectFromAiLedger(range: DateRange): Promise<
  Array<{
    date: string;
    userId?: string;
    workspaceId?: string;
    feature?: string;
    amountMinor: number;
    currency?: string;
    service: CostService;
  }>
> {
  try {
    const { pool } = await import('../memory/db.js');
    const result = await pool.query(
      `SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS day,
              COALESCE(user_id, tenant_id, workspace_id, 'unattributed') AS uid,
              workspace_id,
              COALESCE(provider, 'other') AS provider,
              COALESCE(SUM(provider_cost_minor), 0)::bigint AS cost
       FROM ai_usage_ledger
       WHERE created_at >= $1::date
         AND created_at < ($2::date + INTERVAL '1 day')
       GROUP BY 1, 2, 3, 4`,
      [range.from, range.to],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => {
      const provider = String(row.provider || 'other').toLowerCase();
      const service: CostService =
        provider.includes('anthropic')
          ? 'anthropic'
          : provider.includes('openai') || provider.includes('gpt')
            ? 'openai'
            : provider.includes('google') || provider.includes('gemini')
              ? 'google'
              : 'other';
      return {
        date: String(row.day),
        userId: String(row.uid),
        workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
        feature: 'ai_inference',
        amountMinor: Number(row.cost) || 0,
        currency: 'gbp',
        service,
      };
    });
  } catch {
    return [];
  }
}

export async function collectAIProviderCosts(dateRange: DateRange): Promise<CostRow[]> {
  const fetch = aiFetcher ?? defaultCollectFromAiLedger;
  const raw = await fetch(dateRange);
  return raw.map((r) => ({
    id: newFinanceId('cost'),
    date: r.date,
    userId: r.userId || 'unattributed',
    workspaceId: r.workspaceId,
    service: r.service,
    feature: r.feature ?? 'ai_inference',
    amountMinor: Math.round(r.amountMinor),
    currency: (r.currency || 'gbp').toLowerCase(),
    source: aiFetcher ? 'api' : 'ledger',
  }));
}

export async function collectHostingCosts(dateRange: DateRange): Promise<CostRow[]> {
  const fetch = hostingFetcher;
  if (!fetch) {
    // Env-configured flat monthly hosting (allocated later)
    const monthly = Number(process.env.CARINA_HOSTING_COST_MINOR_MONTHLY || 0);
    if (!monthly) return [];
    return [
      {
        id: newFinanceId('cost'),
        date: dateRange.from,
        userId: '__shared_hosting__',
        service: 'hosting',
        feature: 'platform',
        amountMinor: Math.round(monthly),
        currency: 'gbp',
        source: 'manual',
        note: 'CARINA_HOSTING_COST_MINOR_MONTHLY',
      },
    ];
  }
  const raw = await fetch(dateRange);
  return raw.map((r) => ({
    id: newFinanceId('cost'),
    date: r.date,
    userId: r.userId || '__shared_hosting__',
    workspaceId: r.workspaceId,
    service: 'hosting' as const,
    feature: r.feature ?? 'platform',
    amountMinor: Math.round(r.amountMinor),
    currency: (r.currency || 'gbp').toLowerCase(),
    source: 'api' as const,
  }));
}

export async function collectThirdPartyCosts(dateRange: DateRange): Promise<CostRow[]> {
  const fetch = thirdPartyFetcher;
  if (!fetch) {
    const monthly = Number(process.env.CARINA_THIRD_PARTY_COST_MINOR_MONTHLY || 0);
    if (!monthly) return [];
    return [
      {
        id: newFinanceId('cost'),
        date: dateRange.from,
        userId: '__shared_saas__',
        service: 'third_party',
        feature: 'platform',
        amountMinor: Math.round(monthly),
        currency: 'gbp',
        source: 'manual',
        note: 'CARINA_THIRD_PARTY_COST_MINOR_MONTHLY',
      },
    ];
  }
  const raw = await fetch(dateRange);
  return raw.map((r) => ({
    id: newFinanceId('cost'),
    date: r.date,
    userId: r.userId || '__shared_saas__',
    workspaceId: r.workspaceId,
    service: 'third_party' as const,
    feature: r.feature ?? 'platform',
    amountMinor: Math.round(r.amountMinor),
    currency: (r.currency || 'gbp').toLowerCase(),
    source: 'api' as const,
  }));
}

/**
 * Split shared pool costs across users by their usage share of direct AI costs.
 * Remainder pennies go to the largest user so totals still reconcile to the cent.
 */
export function attributeCostsToUsers(
  directCosts: CostRow[],
  sharedCosts: CostRow[],
): CostRow[] {
  if (sharedCosts.length === 0) return [...directCosts];
  const byUser = new Map<string, number>();
  for (const row of directCosts) {
    if (row.userId.startsWith('__shared_')) continue;
    byUser.set(row.userId, (byUser.get(row.userId) || 0) + row.amountMinor);
  }
  const users = [...byUser.entries()].sort((a, b) => b[1] - a[1]);
  const totalDirect = users.reduce((s, [, v]) => s + v, 0);
  const allocated: CostRow[] = [...directCosts];

  for (const shared of sharedCosts) {
    if (users.length === 0 || totalDirect <= 0) {
      allocated.push({ ...shared, source: 'allocated' });
      continue;
    }
    let remaining = shared.amountMinor;
    users.forEach(([userId, weight], idx) => {
      const isLast = idx === users.length - 1;
      const share = isLast
        ? remaining
        : Math.floor((shared.amountMinor * weight) / totalDirect);
      remaining -= share;
      if (share === 0 && !isLast) return;
      allocated.push({
        id: newFinanceId('cost'),
        date: shared.date,
        userId,
        workspaceId: shared.workspaceId,
        service: shared.service,
        feature: shared.feature,
        amountMinor: share,
        currency: shared.currency,
        source: 'allocated',
        note: `allocated from ${shared.userId}`,
      });
    });
  }
  return allocated;
}

export async function collectAndAttributeMonth(year: number, month: number): Promise<CostRow[]> {
  const range = monthDateRange(year, month);
  const [ai, hosting, third] = await Promise.all([
    collectAIProviderCosts(range),
    collectHostingCosts(range),
    collectThirdPartyCosts(range),
  ]);
  const direct = ai.filter((c) => !c.userId.startsWith('__shared_'));
  const shared = [
    ...ai.filter((c) => c.userId.startsWith('__shared_')),
    ...hosting,
    ...third,
  ];
  const attributed = attributeCostsToUsers(direct, shared);
  replaceMonthCosts(year, month, attributed);
  return attributed;
}

export function peekCosts(range: DateRange): CostRow[] {
  return listCostsInRange(range.from, range.to);
}
