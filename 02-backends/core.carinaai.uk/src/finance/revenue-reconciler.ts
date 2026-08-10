/**
 * Stripe revenue + refunds reconciled to internal user/workspace IDs.
 */

import {
  listRevenueInRange,
  monthDateRange,
  newFinanceId,
  replaceMonthRevenue,
  type RevenueRow,
} from './finance-store.js';
import type { DateRange } from './cost-aggregator.js';
import { listCostsInRange, sumMinor } from './finance-store.js';

export type StripeRevenueFetch = (range: DateRange) => Promise<
  Array<{
    date: string;
    userId: string;
    workspaceId?: string;
    kind: RevenueRow['kind'];
    amountMinor: number;
    currency?: string;
    stripeChargeId?: string;
  }>
>;

let stripeFetcher: StripeRevenueFetch | null = null;

export function setStripeRevenueFetcher(fn: StripeRevenueFetch | null): void {
  stripeFetcher = fn;
}

async function defaultPullStripe(range: DateRange): Promise<
  Array<{
    date: string;
    userId: string;
    workspaceId?: string;
    kind: RevenueRow['kind'];
    amountMinor: number;
    currency?: string;
    stripeChargeId?: string;
  }>
> {
  try {
    const { pool } = await import('../memory/db.js');
    // Prefer recorded Aiva invoices when present
    const result = await pool.query(
      `SELECT DATE(created_at AT TIME ZONE 'UTC')::text AS day,
              workspace_id,
              COALESCE(amount_paid, amount_due, 0)::bigint AS amount,
              COALESCE(currency, 'gbp') AS currency,
              COALESCE(stripe_invoice_id, id::text) AS charge_id,
              COALESCE(status, '') AS status
       FROM aiva_invoices
       WHERE created_at >= $1::date
         AND created_at < ($2::date + INTERVAL '1 day')`,
      [range.from, range.to],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) => {
      const status = String(row.status || '').toLowerCase();
      const amount = Number(row.amount) || 0;
      const kind: RevenueRow['kind'] =
        status.includes('refund') ? 'refund' : amount < 0 ? 'refund' : 'subscription';
      return {
        date: String(row.day),
        userId: String(row.workspace_id),
        workspaceId: String(row.workspace_id),
        kind,
        amountMinor: Math.abs(amount) * (kind === 'refund' ? -1 : 1),
        currency: String(row.currency || 'gbp'),
        stripeChargeId: String(row.charge_id),
      };
    });
  } catch {
    return [];
  }
}

export async function pullStripeRevenue(dateRange: DateRange): Promise<RevenueRow[]> {
  const fetch = stripeFetcher ?? defaultPullStripe;
  const raw = await fetch(dateRange);
  return raw
    .filter((r) => r.kind !== 'refund' && r.kind !== 'chargeback')
    .map((r) => ({
      id: newFinanceId('rev'),
      date: r.date,
      userId: r.userId,
      workspaceId: r.workspaceId,
      kind: r.kind,
      amountMinor: Math.round(r.amountMinor),
      currency: (r.currency || 'gbp').toLowerCase(),
      stripeChargeId: r.stripeChargeId,
      source: stripeFetcher ? 'stripe' : 'stripe',
    }));
}

export async function pullRefunds(dateRange: DateRange): Promise<RevenueRow[]> {
  const fetch = stripeFetcher ?? defaultPullStripe;
  const raw = await fetch(dateRange);
  return raw
    .filter((r) => r.kind === 'refund' || r.kind === 'chargeback' || r.amountMinor < 0)
    .map((r) => ({
      id: newFinanceId('ref'),
      date: r.date,
      userId: r.userId,
      workspaceId: r.workspaceId,
      kind: r.kind === 'chargeback' ? 'chargeback' : 'refund',
      amountMinor: -Math.abs(Math.round(r.amountMinor)),
      currency: (r.currency || 'gbp').toLowerCase(),
      stripeChargeId: r.stripeChargeId,
      source: 'stripe' as const,
    }));
}

export interface UserMarginRow {
  userId: string;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  marginPct: number | null;
  liability: boolean;
}

export function reconcileWithCosts(year: number, month: number): {
  users: UserMarginRow[];
  totalRevenueMinor: number;
  totalCostMinor: number;
  grossMarginMinor: number;
} {
  const { from, to } = monthDateRange(year, month);
  const revenue = listRevenueInRange(from, to);
  const costs = listCostsInRange(from, to);
  const userIds = new Set([
    ...revenue.map((r) => r.userId),
    ...costs.filter((c) => !c.userId.startsWith('__shared_')).map((c) => c.userId),
  ]);

  const users: UserMarginRow[] = [...userIds].map((userId) => {
    const revenueMinor = sumMinor(revenue.filter((r) => r.userId === userId));
    const costMinor = sumMinor(costs.filter((c) => c.userId === userId));
    const marginMinor = revenueMinor - costMinor;
    const marginPct =
      revenueMinor === 0 ? null : Math.round((marginMinor / revenueMinor) * 10_000) / 100;
    return {
      userId,
      revenueMinor,
      costMinor,
      marginMinor,
      marginPct,
      liability: costMinor > revenueMinor,
    };
  });

  const totalRevenueMinor = sumMinor(revenue);
  const totalCostMinor = sumMinor(costs.filter((c) => !c.userId.startsWith('__shared_')));
  return {
    users: users.sort((a, b) => b.revenueMinor - a.revenueMinor),
    totalRevenueMinor,
    totalCostMinor,
    grossMarginMinor: totalRevenueMinor - totalCostMinor,
  };
}

export async function collectMonthRevenue(year: number, month: number): Promise<RevenueRow[]> {
  const range = monthDateRange(year, month);
  const [rev, refunds] = await Promise.all([
    pullStripeRevenue(range),
    pullRefunds(range),
  ]);
  const all = [...rev, ...refunds];
  replaceMonthRevenue(year, month, all);
  return all;
}
