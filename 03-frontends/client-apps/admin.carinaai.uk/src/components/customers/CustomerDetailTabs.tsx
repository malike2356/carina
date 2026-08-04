'use client';

import { Bot, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PlanStatusBadge } from '@/components/customers/CustomerBadges';
import { capitalize, formatDate, timeAgo } from '@/lib/format';

interface AivaRow {
  id: string;
  name: string;
  role: string;
  status: string;
  lastActiveAt: string | null;
  escalationCount: number;
  attestationCoverage: number;
}

interface ActivityRow {
  id: string;
  workerName: string;
  actionType: string;
  summary: string;
  createdAt: string;
  attestationTx: string | null;
}

interface SignalRow {
  id: string;
  eventType: string;
  severity: string;
  summary: string;
  createdAt: string;
}

interface InvoiceRow {
  id: string;
  stripeInvoiceId: string;
  amount: number;
  status: string;
  paidAt: string;
  invoicePdfUrl: string | null;
}

interface WalletBalance {
  remainingGbp?: number;
  remainingPence?: number;
  trialGrantedPence?: number;
  purchasedPence?: number;
  debitedPence?: number;
  lowCredit?: boolean;
  exhausted?: boolean;
}

interface WalletLedgerRow {
  id: string | number;
  eventType: string;
  amountPence: number;
  model?: string | null;
  note?: string | null;
  createdAt: string;
}

interface SubscriptionInfo {
  planTier: string;
  status: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  monthlyAmountPence: number;
  cancelAtPeriodEnd?: boolean;
}

type TabId = 'aivas' | 'activity' | 'signals' | 'billing';

function attestColor(coverage: number): string {
  const pct = Math.round(coverage * 100);
  if (pct >= 95) return 'text-green-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function AivaStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-400',
    paused: 'bg-amber-400',
    error: 'bg-red-400',
    configuring: 'bg-blue-400',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status] ?? 'bg-text-muted'}`} />
      {capitalize(status)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400',
    warning: 'bg-amber-500/15 text-amber-400',
    info: 'bg-gray-500/10 text-text-muted',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${styles[severity] ?? styles.info}`}
    >
      {severity}
    </span>
  );
}

function formatGbpFromPence(pence?: number): string {
  return `GBP ${((pence ?? 0) / 100).toFixed(2)}`;
}

export function CustomerDetailTabs({
  workspaceId,
  subscription,
  aivas,
  recentActivity: initialActivity,
  recentSignals,
  invoices,
  onPauseAiva,
}: {
  workspaceId: string;
  subscription: SubscriptionInfo;
  aivas: AivaRow[];
  recentActivity: ActivityRow[];
  recentSignals: SignalRow[];
  invoices: InvoiceRow[];
  onPauseAiva: (workerId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('aivas');
  const [activity, setActivity] = useState(initialActivity);
  const [activityOffset, setActivityOffset] = useState(initialActivity.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreActivity, setHasMoreActivity] = useState(initialActivity.length >= 20);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [walletLedger, setWalletLedger] = useState<WalletLedgerRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const stripeDashboardBase =
    process.env.NEXT_PUBLIC_STRIPE_DASHBOARD_URL ?? 'https://dashboard.stripe.com/customers';

  const loadMoreActivity = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/admin/workspaces/${workspaceId}/activity?limit=20&offset=${activityOffset}`,
      );
      const body = (await res.json()) as { activity?: ActivityRow[] };
      const rows = body.activity ?? [];
      setActivity((prev) => [...prev, ...rows]);
      setActivityOffset((prev) => prev + rows.length);
      if (rows.length < 20) setHasMoreActivity(false);
    } finally {
      setLoadingMore(false);
    }
  }, [workspaceId, activityOffset]);

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}/ai-wallet`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        balance?: WalletBalance;
        ledger?: WalletLedgerRow[];
      };
      setWalletBalance(body.balance ?? null);
      setWalletLedger(body.ledger ?? []);
    } finally {
      setWalletLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setActivity(initialActivity);
    setActivityOffset(initialActivity.length);
    setHasMoreActivity(initialActivity.length >= 20);
  }, [initialActivity]);

  useEffect(() => {
    if (activeTab === 'billing') void loadWallet();
  }, [activeTab, loadWallet]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'aivas', label: 'Aivas' },
    { id: 'activity', label: 'Activity' },
    { id: 'signals', label: 'Scout Signals' },
    { id: 'billing', label: 'Billing' },
  ];

  return (
    <div>
      <div className="mb-5 border-b border-border">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'border-b-2 px-3 py-2 text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-amber-400 font-medium text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'aivas' ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="py-2 pr-4 text-left font-medium">Name</th>
              <th className="py-2 pr-4 text-left font-medium">Role</th>
              <th className="py-2 pr-4 text-left font-medium">Status</th>
              <th className="py-2 pr-4 text-left font-medium">Last active</th>
              <th className="py-2 pr-4 text-left font-medium">Escalations</th>
              <th className="py-2 pr-4 text-left font-medium">Attestation</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {aivas.map((aiva) => (
              <tr key={aiva.id}>
                <td className="py-2 pr-4 font-medium text-text-primary">{aiva.name}</td>
                <td className="py-2 pr-4 text-text-muted">{aiva.role.slice(0, 30)}</td>
                <td className="py-2 pr-4">
                  <AivaStatusDot status={aiva.status} />
                </td>
                <td className="py-2 pr-4 text-text-muted">{timeAgo(aiva.lastActiveAt)}</td>
                <td className="py-2 pr-4 text-text-muted">{aiva.escalationCount}</td>
                <td className={`py-2 pr-4 ${attestColor(aiva.attestationCoverage)}`}>
                  {Math.round(aiva.attestationCoverage * 100)}%
                </td>
                <td className="py-2">
                  {aiva.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onPauseAiva(aiva.id)}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Pause
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {activeTab === 'activity' ? (
        <div>
          <div className="divide-y divide-border">
            {activity.length === 0 ? (
              <p className="py-4 text-sm text-text-muted">No recent activity.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="rounded bg-overlay px-1.5 py-0.5 text-[10px] text-text-muted">
                    {item.actionType}
                  </span>
                  <span className="flex-1 truncate text-xs text-text-secondary">{item.summary}</span>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-text-muted">
                    {timeAgo(item.createdAt)}
                  </span>
                  {item.attestationTx ? (
                    <a
                      href={`https://explorer.solana.com/tx/${item.attestationTx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[11px] text-green-400 hover:underline"
                    >
                      On-chain
                    </a>
                  ) : (
                    <span className="shrink-0 text-[11px] text-text-muted">Pending</span>
                  )}
                </div>
              ))
            )}
          </div>
          {hasMoreActivity ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMoreActivity()}
              className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'signals' ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {recentSignals.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">No Scout signals in the last period.</p>
          ) : (
            recentSignals.map((sig) => (
              <div
                key={sig.id}
                className={[
                  'flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0',
                  sig.severity === 'critical' && 'border-l-2 border-red-500/40 bg-red-500/5',
                  sig.severity === 'warning' && 'border-l-2 border-amber-400/30 bg-amber-500/5',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <SeverityBadge severity={sig.severity} />
                <span className="font-mono text-xs text-text-muted">{sig.eventType}</span>
                <span className="flex-1 truncate text-xs text-text-secondary">{sig.summary}</span>
                <span className="whitespace-nowrap text-[11px] text-text-muted">
                  {timeAgo(sig.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'billing' ? (
        <div className="space-y-4">
          <div className="relative rounded-lg border border-border bg-elevated p-4">
            <span className="absolute top-3 right-3 text-[10px] uppercase text-text-muted">
              Read only
            </span>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-text-muted">Plan: </span>
                <PlanStatusBadge
                  ws={{
                    planTier: subscription.planTier,
                    subscriptionStatus: subscription.status,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                  }}
                />
              </p>
              <p className="text-text-secondary">
                Next renewal:{' '}
                {subscription.currentPeriodEnd
                  ? formatDate(subscription.currentPeriodEnd)
                  : 'Not scheduled'}
              </p>
              {subscription.stripeCustomerId ? (
                <p className="font-mono text-xs">
                  <a
                    href={`${stripeDashboardBase}/${subscription.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Stripe: {subscription.stripeCustomerId}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 text-left font-medium">Invoice</th>
                <th className="py-2 text-left font-medium">Amount</th>
                <th className="py-2 text-left font-medium">Status</th>
                <th className="py-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2 font-mono text-text-secondary">
                    {inv.invoicePdfUrl ? (
                      <a
                        href={inv.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {inv.stripeInvoiceId}
                      </a>
                    ) : (
                      inv.stripeInvoiceId
                    )}
                  </td>
                  <td className="py-2 text-text-secondary">
                    GBP {(inv.amount / 100).toFixed(2)}
                  </td>
                  <td className="py-2 text-text-secondary">{inv.status}</td>
                  <td className="py-2 text-text-muted">{formatDate(inv.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rounded-lg border border-border bg-elevated p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">AI usage wallet</h2>
                <p className="mt-0.5 text-xs text-text-muted">
                  Assigned budget and spend for managed Aiva model calls. Top up from Quick actions
                  on the right.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadWallet()}
                className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-overlay"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded border border-border bg-base px-3 py-2">
                <p className="text-[10px] uppercase text-text-muted">Remaining</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {walletBalance
                    ? formatGbpFromPence(
                      walletBalance.remainingPence
                        ?? Math.round((walletBalance.remainingGbp ?? 0) * 100),
                    )
                    : walletLoading ? 'Loading...' : 'Unavailable'}
                </p>
              </div>
              <div className="rounded border border-border bg-base px-3 py-2">
                <p className="text-[10px] uppercase text-text-muted">Trial</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {formatGbpFromPence(walletBalance?.trialGrantedPence)}
                </p>
              </div>
              <div className="rounded border border-border bg-base px-3 py-2">
                <p className="text-[10px] uppercase text-text-muted">Purchased</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {formatGbpFromPence(walletBalance?.purchasedPence)}
                </p>
              </div>
              <div className="rounded border border-border bg-base px-3 py-2">
                <p className="text-[10px] uppercase text-text-muted">Used</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {formatGbpFromPence(walletBalance?.debitedPence)}
                </p>
              </div>
            </div>
            {walletLedger.length === 0 ? (
              <p className="text-xs text-text-muted">
                No wallet ledger rows yet. Apply AI usage credit from Admin overrides to create one.
              </p>
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <div className="grid grid-cols-[120px_100px_minmax(0,1fr)_150px] border-b border-border bg-base px-3 py-2 text-[11px] font-medium text-text-muted max-sm:hidden">
                  <span>Type</span>
                  <span>Amount</span>
                  <span>Note</span>
                  <span>Date</span>
                </div>
                {walletLedger.slice(0, 20).map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[120px_100px_minmax(0,1fr)_150px] gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0 max-sm:flex max-sm:flex-col"
                  >
                    <span className="font-medium text-text-primary">{row.eventType}</span>
                    <span className={row.amountPence < 0 ? 'text-red-400' : 'text-green-400'}>
                      {formatGbpFromPence(row.amountPence)}
                    </span>
                    <span className="truncate text-text-secondary">
                      {row.note || row.model || '-'}
                    </span>
                    <span className="text-text-muted">{formatDate(row.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
