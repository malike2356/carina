import { useEffect, useState } from 'react';
import { api } from '../api/client';

type BillingState = {
  plan: string;
  limit: number | null;
  period: string;
  stripeConfigured: boolean;
};

export function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');

  useEffect(() => {
    void api<BillingState>('/api/cloud/billing').then(setBilling).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load billing');
    });
  }, []);

  async function upgrade(plan: 'starter' | 'team') {
    setPending(plan);
    setError('');
    try {
      const data = await api<{ url: string }>('/api/cloud/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setPending('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-slate-600">Current plan: {billing?.plan ?? 'loading...'}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Carina is the free workspace. Scout is the paid layer that adds security, audit logs, and controls once a workflow moves into client data.
        </p>
      </div>
      {billing && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Limit: {billing.limit?.toLocaleString() ?? 'unlimited'} tokens per {billing.period}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { id: 'free', name: 'Free', price: 'GBP 0', desc: '50k tokens/day, BYOK only' },
          { id: 'starter', name: 'Starter', price: 'GBP 19/mo', desc: '500k tokens/month' },
          { id: 'team', name: 'Team', price: 'GBP 79/mo', desc: 'Workspace plus Scout pairing' },
        ].map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-1 text-xl font-semibold">{plan.price}</p>
            <p className="mt-2 text-sm text-slate-600">{plan.desc}</p>
            {billing?.plan === plan.id ? (
              <p className="mt-4 text-sm font-medium">Current plan</p>
            ) : plan.id !== 'free' ? (
              <button
                type="button"
                onClick={() => void upgrade(plan.id as 'starter' | 'team')}
                disabled={pending === plan.id}
                className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
              >
                {pending === plan.id ? 'Redirecting...' : 'Upgrade'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
