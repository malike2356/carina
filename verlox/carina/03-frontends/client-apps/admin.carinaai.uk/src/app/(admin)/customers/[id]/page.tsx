'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CustomerDetailTabs } from '@/components/customers/CustomerDetailTabs';
import { PlanStatusBadge } from '@/components/customers/CustomerBadges';
import { OverridePanel } from '@/components/customers/OverridePanel';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatDate, timeAgo } from '@/lib/format';

interface WorkspaceDetailResponse {
  workspace: {
    workspaceId: string;
    name: string;
    ownerEmail: string | null;
    createdAt: string | null;
    adminNotes: string;
  };
  subscription: {
    planTier: string;
    status: string;
    trialEndsAt: string | null;
    slotLimit: number;
    aivasUsed: number;
    stripeCustomerId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    monthlyAmountPence: number;
  };
  lastActiveAt: string | null;
  aivas: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    lastActiveAt: string | null;
    escalationCount: number;
    attestationCoverage: number;
  }>;
  recentActivity: Array<{
    id: string;
    workerName: string;
    actionType: string;
    summary: string;
    createdAt: string;
    attestationTx: string | null;
  }>;
  recentSignals: Array<{
    id: string;
    eventType: string;
    severity: string;
    summary: string;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    stripeInvoiceId: string;
    amount: number;
    status: string;
    paidAt: string;
    invoicePdfUrl: string | null;
  }>;
}

function CopyIdButton({ id }: { id: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(id);
        push('Workspace ID copied', 'info');
      }}
      className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:bg-overlay"
    >
      {id.slice(0, 8)}...
    </button>
  );
}

function friendlyError(message: string): string {
  if (message.includes('uuid') || message.includes('operator does not exist')) {
    return 'Could not load this customer. The server query failed; try again in a moment.';
  }
  return message;
}

function StatChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5">
      <span className="text-xs text-text-muted">{label}:</span>
      <span className="text-xs font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { push: toast } = useToast();
  const [workspaceId, setWorkspaceId] = useState('');
  const [data, setData] = useState<WorkspaceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/workspaces/${id}`, { cache: 'no-store' });
      const body = (await res.json()) as WorkspaceDetailResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load workspace');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void params.then((p) => {
      setWorkspaceId(p.id);
      void load(p.id);
    });
  }, [params, load]);

  async function pauseAiva(workerId: string) {
    if (!window.confirm('Pause this Aiva via kill switch?')) return;
    try {
      const res = await fetch(`/api/admin/fleet/${workerId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Paused from customer detail' }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Pause failed');
      toast('Aiva paused', 'success');
      if (workspaceId) await load(workspaceId);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Pause failed', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Link href="/customers" className="text-xs text-accent hover:underline">
          Back to customers
        </Link>
        <div
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <p className="font-medium">Could not load customer</p>
          <p className="mt-1 text-red-200/80">{friendlyError(error || 'Workspace not found')}</p>
          {workspaceId ? (
            <button
              type="button"
              onClick={() => void load(workspaceId)}
              className="mt-3 rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/10"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const { workspace, subscription, aivas, recentActivity, recentSignals, invoices, lastActiveAt } =
    data;
  const activeAivaCount = aivas.filter((a) => a.status === 'active').length;
  const pausedAivaCount = aivas.filter((a) => a.status === 'paused').length;

  return (
    <div>
      <nav className="mb-4 text-xs text-text-muted">
        <Link href="/customers" className="hover:text-text-primary">
          Customers
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-text-primary">{workspace.name}</span>
      </nav>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_288px]">
        <div>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{workspace.name}</h1>
              <p className="mt-0.5 text-sm text-text-muted">
                {workspace.ownerEmail ?? 'No owner email'}
                <span className="mx-1.5">·</span>
                Created {formatDate(workspace.createdAt)}
              </p>
            </div>
            <CopyIdButton id={workspace.workspaceId} />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <StatChip
              label="Plan"
              value={
                <PlanStatusBadge
                  ws={{
                    planTier: subscription.planTier,
                    subscriptionStatus: subscription.status,
                  }}
                />
              }
            />
            <StatChip
              label="Aivas"
              value={`${subscription.aivasUsed}/${subscription.slotLimit}`}
            />
            <StatChip
              label="MRR"
              value={
                subscription.monthlyAmountPence > 0
                  ? `GBP ${(subscription.monthlyAmountPence / 100).toFixed(0)}`
                  : '-'
              }
            />
            <StatChip label="Last active" value={timeAgo(lastActiveAt)} />
          </div>

          <CustomerDetailTabs
            workspaceId={workspace.workspaceId}
            subscription={subscription}
            aivas={aivas}
            recentActivity={recentActivity}
            recentSignals={recentSignals}
            invoices={invoices}
            onPauseAiva={(id) => void pauseAiva(id)}
          />
        </div>

        <OverridePanel
          workspaceId={workspace.workspaceId}
          workspaceName={workspace.name}
          ownerEmail={workspace.ownerEmail}
          subscription={subscription}
          adminNotes={workspace.adminNotes}
          activeAivaCount={activeAivaCount}
          pausedAivaCount={pausedAivaCount}
          onUpdated={() => void load(workspace.workspaceId)}
        />
      </div>
    </div>
  );
}
