'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Modal } from '@/components/ui/Modal';
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { capitalize, formatDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';

const TIER_ORDER = ['trial', 'starter', 'team', 'business'] as const;

interface RevenueSummary {
  mrr: number;
  arr: number;
  mrrFormatted: string;
  arrFormatted: string;
  activeCount: number;
  trialCount: number;
  arpu: number;
  trialConversionRate: number;
  tierCounts?: Record<string, number>;
  tierMrr?: Record<string, number>;
}

interface TimelinePoint {
  month: string;
  mrr: number;
  newMrr: number;
  churnedMrr: number;
}

interface AtRiskItem {
  workspaceId: string;
  workspaceName: string;
  ownerEmail?: string | null;
  planTier?: string;
  graceDaysRemaining?: number;
  monthlyAmountPence?: number;
  trialDaysRemaining?: number;
  currentPeriodEnd?: string | null;
}

interface InvoiceRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  ownerEmail?: string | null;
  amount: number;
  currency: string;
  status: string;
  planTier?: string;
  invoicePdfUrl?: string | null;
  createdAt: string;
}

function tierPct(tier: string, mrr: number, tierMrr: Record<string, number>): number {
  if (mrr <= 0) return 0;
  return ((tierMrr[tier] ?? 0) / mrr) * 100;
}

export default function RevenuePage() {
  const { push: toast } = useToast();
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [atRisk, setAtRisk] = useState<{
    pastDue: AtRiskItem[];
    trialExpiringSoon: AtRiskItem[];
    cancellingAtPeriodEnd: AtRiskItem[];
  } | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const debouncedInvoiceSearch = useDebouncedValue(invoiceSearch, 350);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [error, setError] = useState('');
  const [refundTarget, setRefundTarget] = useState<InvoiceRow | null>(null);
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [refundError, setRefundError] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState('');

  const { visibleItems: visibleInvoices, hasMore, sentinelRef } = useInfiniteScroll(invoices, 20);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, timelineRes, atRiskRes] = await Promise.all([
        fetch('/api/admin/revenue/summary'),
        fetch('/api/admin/revenue/timeline'),
        fetch('/api/admin/revenue/at-risk'),
      ]);
      const summaryBody = (await summaryRes.json()) as RevenueSummary & { error?: string };
      const timelineBody = (await timelineRes.json()) as { timeline?: TimelinePoint[] };
      const atRiskBody = (await atRiskRes.json()) as {
        pastDue?: AtRiskItem[];
        trialExpiringSoon?: AtRiskItem[];
        cancellingAtPeriodEnd?: AtRiskItem[];
      };
      if (!summaryRes.ok) throw new Error(summaryBody.error ?? 'Failed to load revenue');
      setSummary(summaryBody);
      setTimeline(timelineBody.timeline ?? []);
      setAtRisk({
        pastDue: atRiskBody.pastDue ?? [],
        trialExpiringSoon: atRiskBody.trialExpiringSoon ?? [],
        cancellingAtPeriodEnd: atRiskBody.cancellingAtPeriodEnd ?? [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load revenue';
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceStatus !== 'all') params.set('status', invoiceStatus);
      if (debouncedInvoiceSearch) params.set('search', debouncedInvoiceSearch);
      const res = await fetch(`/api/admin/revenue/invoices?${params}`);
      const body = (await res.json()) as { invoices?: InvoiceRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load invoices');
      setInvoices(body.invoices ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoices', 'error');
    } finally {
      setInvoicesLoading(false);
    }
  }, [debouncedInvoiceSearch, invoiceStatus, toast]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  async function confirmRefund() {
    if (!refundTarget || refundNote.trim().length < 10) return;
    setRefundLoading(true);
    setRefundError('');
    try {
      const res = await fetch('/api/admin/revenue/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: refundTarget.id,
          reason: refundReason,
          note: refundNote.trim(),
        }),
      });
      const body = (await res.json()) as { error?: string; stripeRefundId?: string };
      if (!res.ok) {
        setRefundError(body.error ?? 'Refund failed');
        return;
      }
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === refundTarget.id ? { ...inv, status: 'refunded' } : inv)),
      );
      setRefundSuccess(`Refunded. Stripe ID: ${body.stripeRefundId ?? 'pending'}`);
      setTimeout(() => setRefundSuccess(''), 5000);
      setRefundTarget(null);
      setRefundNote('');
      void loadSummary();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setRefundLoading(false);
    }
  }

  const tierMrr = summary?.tierMrr ?? {};
  const tierCounts = summary?.tierCounts ?? {};
  const totalMrr = summary?.mrr ?? 0;

  const statusStyles: Record<string, string> = useMemo(
    () => ({
      paid: 'bg-green-500/10 text-green-400',
      open: 'bg-amber-500/10 text-amber-400',
      void: 'bg-gray-500/10 text-text-muted',
      refunded: 'bg-red-500/10 text-red-400/70',
    }),
    [],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Revenue</h1>
        <p className="mt-0.5 text-sm text-text-muted">Billing summary from live subscriptions</p>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <ChartSkeleton />
            <TableSkeleton rows={4} cols={4} />
          </div>
        </>
      ) : summary ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <RevenueCard label="MRR" value={summary.mrrFormatted} highlight />
            <RevenueCard label="ARR" value={summary.arrFormatted} />
            <RevenueCard label="Active" value={String(summary.activeCount)} />
            <RevenueCard label="Trial" value={String(summary.trialCount)} />
            <RevenueCard label="ARPU" value={`£${(summary.arpu / 100).toFixed(2)}`} />
            <RevenueCard
              label="Conversion"
              value={`${(summary.trialConversionRate * 100).toFixed(0)}%`}
            />
          </div>

          <div className="mb-6 rounded-lg border border-border bg-elevated p-4">
            <h2 className="mb-4 text-sm font-medium text-text-primary">MRR trend (12 months)</h2>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    stroke="#666"
                    tickFormatter={(m: string) => m.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={50}
                    stroke="#666"
                    tickFormatter={(v: number) => `£${(v / 100).toFixed(0)}`}
                  />
                  <Tooltip
                    formatter={(v: number) => `£${(v / 100).toFixed(2)}`}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Line
                    dataKey="mrr"
                    name="Total MRR"
                    stroke="#f5a623"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="newMrr"
                    name="New MRR"
                    stroke="#4ade80"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    dataKey="churnedMrr"
                    name="Churned"
                    stroke="#f87171"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-elevated p-4">
              <h2 className="mb-3 text-sm font-medium text-text-primary">Subscriptions by tier</h2>
              <table className="mb-3 w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] text-text-muted">
                    <th className="py-1.5 text-left font-medium">Tier</th>
                    <th className="py-1.5 text-right font-medium">Count</th>
                    <th className="py-1.5 text-right font-medium">MRR</th>
                    <th className="py-1.5 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TIER_ORDER.map((tier) => {
                    const count = tierCounts[tier] ?? 0;
                    const mrr = tierMrr[tier] ?? 0;
                    const pct = totalMrr > 0 ? ((mrr / totalMrr) * 100).toFixed(0) : '0';
                    return (
                      <tr key={tier}>
                        <td className="py-1.5 capitalize text-text-secondary">{tier}</td>
                        <td className="py-1.5 text-right text-text-muted">{count}</td>
                        <td className="py-1.5 text-right text-text-muted">
                          {mrr > 0 ? `£${(mrr / 100).toFixed(0)}` : '-'}
                        </td>
                        <td className="py-1.5 text-right text-text-muted">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full">
                <div
                  style={{ width: `${tierPct('trial', totalMrr, tierMrr)}%` }}
                  className="bg-gray-600"
                />
                <div
                  style={{ width: `${tierPct('starter', totalMrr, tierMrr)}%` }}
                  className="bg-blue-500/60"
                />
                <div
                  style={{ width: `${tierPct('team', totalMrr, tierMrr)}%` }}
                  className="bg-teal-500/60"
                />
                <div
                  style={{ width: `${tierPct('business', totalMrr, tierMrr)}%` }}
                  className="bg-amber-500/60"
                />
              </div>
              <div className="mt-1.5 flex gap-3 text-[10px] text-text-muted">
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-gray-600" />
                  Trial
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-blue-500/60" />
                  Starter
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-teal-500/60" />
                  Team
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-amber-500/60" />
                  Business
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <AtRiskPanel
                title={`Payment failures (${atRisk?.pastDue.length ?? 0})`}
                items={atRisk?.pastDue ?? []}
                renderItem={(item) => (
                  <>
                    <Link
                      href={`/customers/${item.workspaceId}`}
                      className="text-accent hover:underline"
                    >
                      {item.workspaceName}
                    </Link>
                    <span className="text-text-muted">
                      {item.graceDaysRemaining ?? 0}d grace
                    </span>
                  </>
                )}
              />
              <AtRiskPanel
                title={`Trials expiring (${atRisk?.trialExpiringSoon.length ?? 0})`}
                items={atRisk?.trialExpiringSoon ?? []}
                renderItem={(item) => (
                  <>
                    <Link
                      href={`/customers/${item.workspaceId}`}
                      className="text-accent hover:underline"
                    >
                      {item.workspaceName}
                    </Link>
                    <span className="text-text-muted">{item.trialDaysRemaining ?? 0}d left</span>
                  </>
                )}
              />
              <AtRiskPanel
                title={`Cancelling (${atRisk?.cancellingAtPeriodEnd.length ?? 0})`}
                items={atRisk?.cancellingAtPeriodEnd ?? []}
                renderItem={(item) => (
                  <>
                    <Link
                      href={`/customers/${item.workspaceId}`}
                      className="text-accent hover:underline"
                    >
                      {item.workspaceName}
                    </Link>
                    <span className="capitalize text-text-muted">{item.planTier}</span>
                  </>
                )}
              />
            </div>
          </div>
        </>
      ) : (
        <p className="mb-6 text-sm text-text-muted">
          Revenue summary is unavailable. Check billing configuration or try again shortly.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Recent invoices</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            placeholder="Search customer email..."
            className="rounded border border-border bg-elevated px-2 py-1 text-xs text-text-primary"
          />
          <select
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value)}
            aria-label="Filter invoices by status"
            className="rounded border border-border bg-elevated px-2 py-1 text-xs text-text-primary"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="open">Open</option>
            <option value="void">Void</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {refundSuccess ? (
        <div className="mb-3 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {refundSuccess}
        </div>
      ) : null}

      {invoicesLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-overlay text-[11px] text-text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                <th className="px-4 py-2.5 text-left font-medium">Tier</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">PDF</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No invoices match your filters.
                  </td>
                </tr>
              ) : (
                visibleInvoices.map((inv) => (
                  <tr key={inv.id} className="group border-b border-border">
                    <td className="px-4 py-2.5 text-text-muted">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/customers/${inv.workspaceId}`}
                        className="text-accent hover:underline"
                      >
                        {inv.workspaceName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-text-muted">{inv.planTier ?? '-'}</td>
                    <td className="px-4 py-2.5 text-right text-text-primary">
                      £{(inv.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${statusStyles[inv.status] ?? ''}`}
                      >
                        {capitalize(inv.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.invoicePdfUrl ? (
                        <a
                          href={inv.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline"
                        >
                          PDF
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      {inv.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundTarget(inv);
                            setRefundNote('');
                            setRefundError('');
                            setRefundReason('requested_by_customer');
                          }}
                          className="text-[11px] text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                        >
                          Refund
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {hasMore ? <div ref={sentinelRef} className="h-8" aria-hidden /> : null}
        </div>
      )}

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => {
          setRefundTarget(null);
          setRefundError('');
        }}
        title={refundTarget ? `Issue refund for ${refundTarget.workspaceName}` : 'Issue refund'}
        description={
          refundTarget ? `£${(refundTarget.amount / 100).toFixed(2)}` : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setRefundTarget(null);
                setRefundError('');
              }}
              className="px-4 py-2 text-sm text-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={refundLoading || refundNote.trim().length < 10}
              onClick={() => void confirmRefund()}
              className="rounded bg-red-500/20 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
            >
              {refundLoading ? 'Processing...' : 'Issue refund'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Reason</label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              aria-label="Refund reason"
              className="w-full rounded border border-border bg-base px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate payment</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Note (required)
            </label>
            <textarea
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              rows={2}
              placeholder="Describe why this refund is being issued (min 10 characters)"
              className="w-full rounded border border-border bg-base px-2 py-1.5 text-xs text-text-primary"
            />
          </div>
          {refundError ? <p className="text-xs text-danger">{refundError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}

function RevenueCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={[
          'mt-2 font-semibold',
          highlight ? 'text-3xl text-amber-400' : 'text-2xl text-text-primary',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

function AtRiskPanel<T extends AtRiskItem>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <p className="mb-2 text-xs font-medium text-amber-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-text-muted">None</p>
      ) : (
        items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
            {renderItem(item)}
          </div>
        ))
      )}
      {items.length > 3 ? (
        <p className="mt-1 text-[11px] text-text-muted">+{items.length - 3} more</p>
      ) : null}
    </div>
  );
}
