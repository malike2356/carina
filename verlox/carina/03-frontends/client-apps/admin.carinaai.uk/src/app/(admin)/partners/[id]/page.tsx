'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatGbp } from '@/lib/format';

type Tab = 'overview' | 'keys' | 'orgs' | 'sla';

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ClientOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  created_at: string;
}

interface SlaCredit {
  id: string;
  billing_month: string;
  downtime_minutes: number;
  credit_pence: number;
  stripe_credit_id: string | null;
  applied_at: string | null;
}

interface PartnerDetail {
  partner: {
    id: string;
    name: string;
    slug: string;
    status: string;
    commercialTier: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  apiKeys: ApiKey[];
  clientOrgs: ClientOrg[];
  usageThisMonth: {
    events: number;
    tokensIn: number;
    tokensOut: number;
    toolCalls: number;
    skillCalls: number;
    estimatedFeePence: number;
  };
  slaCredits: SlaCredit[];
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'bg-green-100 text-green-800'
    : status === 'suspended' ? 'bg-amber-100 text-amber-800'
    : 'bg-elevated text-text-secondary';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push: toast } = useToast();
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [acting, setActing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function changeStatus(newStatus: 'active' | 'suspended') {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        toast('Status update failed.', 'error');
        return;
      }
      toast(`Partner ${newStatus === 'active' ? 'reactivated' : 'suspended'}.`, 'success');
      setConfirmStatus(false);
      await reload();
    } finally {
      setActing(false);
    }
  }

  async function revokeKey(keyId: string) {
    setRevokingKey(keyId);
    try {
      const res = await fetch(`/api/admin/partners/${id}/keys/${keyId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast('Revoke failed.', 'error');
        return;
      }
      toast('Key revoked.', 'success');
      await reload();
    } finally {
      setRevokingKey(null);
    }
  }

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading...</div>;
  if (!data) return <div className="p-6 text-sm text-text-muted">Partner not found.</div>;

  const { partner, apiKeys, clientOrgs, usageThisMonth, slaCredits } = data;
  const activeKeys = apiKeys.filter((k) => k.status === 'active');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'keys', label: 'API Keys' },
    { key: 'orgs', label: 'Client Orgs' },
    { key: 'sla', label: 'SLA Credits' },
  ];

  return (
    <div className="space-y-6 p-6">
      <Link href="/partners" className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Partners
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">{partner.name}</h1>
        <StatusBadge status={partner.status} />
        {partner.commercialTier && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary capitalize">
            {partner.commercialTier}
          </span>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Events (mo.)', value: usageThisMonth.events.toLocaleString() },
          { label: 'Est. fee', value: formatGbp(usageThisMonth.estimatedFeePence) },
          { label: 'Client orgs', value: clientOrgs.length },
          { label: 'Active keys', value: activeKeys.length },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-accent-primary text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <dl className="divide-y divide-border text-sm">
              {[
                ['ID', partner.id],
                ['Slug', partner.slug],
                ['Stripe customer', partner.stripeCustomerId ?? '-'],
                ['Stripe subscription', partner.stripeSubscriptionId ?? '-'],
                ['Created', formatDate(partner.createdAt)],
                ['Updated', formatDate(partner.updatedAt)],
              ].map(([label, val]) => (
                <div key={String(label)} className="grid grid-cols-3 gap-2 py-2">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="col-span-2 font-mono text-xs text-text-primary">{val}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            {!confirmStatus ? (
              partner.status === 'active' ? (
                <button
                  onClick={() => setConfirmStatus(true)}
                  className="rounded-md border border-amber-400 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  Suspend partner
                </button>
              ) : partner.status === 'suspended' ? (
                <button
                  onClick={() => setConfirmStatus(true)}
                  className="rounded-md border border-green-500 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                >
                  Reactivate partner
                </button>
              ) : null
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">
                  {partner.status === 'active' ? 'Suspend' : 'Reactivate'} this partner?
                </span>
                <button
                  onClick={() => void changeStatus(partner.status === 'active' ? 'suspended' : 'active')}
                  disabled={acting}
                  className="rounded-md bg-accent-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmStatus(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: API Keys */}
      {tab === 'keys' && (
        activeKeys.length === 0 ? (
          <p className="text-sm text-text-muted">No active API keys.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50">
                  {['Label', 'Prefix', 'Scopes', 'Rate limit', 'Last used', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeKeys.map((k) => (
                  <tr key={k.id} className="bg-surface">
                    <td className="px-4 py-3 font-medium text-text-primary">{k.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{k.keyPrefix}...</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="rounded-full bg-elevated px-2 py-0.5 text-xs text-text-secondary">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{k.rateLimitRpm}/min</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}</td>
                    <td className="px-4 py-3 text-right">
                      {revokingKey === k.id ? (
                        <span className="text-xs text-text-muted">Revoking...</span>
                      ) : (
                        <button
                          onClick={() => void revokeKey(k.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Client Orgs */}
      {tab === 'orgs' && (
        clientOrgs.length === 0 ? (
          <p className="text-sm text-text-muted">No client organizations.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50">
                  {['Name', 'Slug', 'Plan', 'Status', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientOrgs.map((o) => (
                  <tr key={o.id} className="bg-surface">
                    <td className="px-4 py-3 font-medium text-text-primary">{o.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{o.slug}</td>
                    <td className="px-4 py-3 capitalize text-text-secondary">{o.plan}</td>
                    <td className="px-4 py-3 capitalize text-text-secondary">{o.status}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: SLA Credits */}
      {tab === 'sla' && (
        slaCredits.length === 0 ? (
          <p className="text-sm text-text-muted">No SLA credits issued for this partner.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50">
                  {['Billing month', 'Downtime (min)', 'Credit', 'Stripe ID', 'Applied at'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slaCredits.map((c) => (
                  <tr key={c.id} className="bg-surface">
                    <td className="px-4 py-3 text-text-primary">{c.billing_month}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.downtime_minutes}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatGbp(c.credit_pence)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{c.stripe_credit_id ?? '-'}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.applied_at ? formatDate(c.applied_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
