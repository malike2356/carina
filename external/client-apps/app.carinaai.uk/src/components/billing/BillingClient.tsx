'use client';

import { useState } from 'react';
import { PlanCard } from '@/components/billing/PlanCard';
import { UsageMeter } from '@/components/billing/UsageMeter';

export function BillingClient({
  plan,
  dailyUsed,
  monthlyUsed,
  limit,
  period,
}: {
  plan: string;
  dailyUsed: number;
  monthlyUsed: number;
  limit: number | null;
  period: 'day' | 'month' | 'unlimited';
}) {
  const [pending, setPending] = useState<string | null>(null);

  async function upgrade(target: 'starter' | 'team') {
    setPending(target);
    const res = await fetch('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: target }),
    });
    const data = await res.json() as { url?: string };
    if (data.url) window.location.href = data.url;
    setPending(null);
  }

  const used = period === 'day' ? dailyUsed : monthlyUsed;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Usage</h2>
        <UsageMeter
          label={period === 'day' ? 'Daily tokens' : period === 'month' ? 'Monthly tokens' : 'Tokens'}
          used={used}
          limit={limit}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <PlanCard
          name="Free"
          price="GBP 0"
          description="50k tokens per day, BYOK only, 1 user."
          active={plan === 'free'}
        />
        <PlanCard
          name="Starter"
          price="GBP 19 / month"
          description="500k tokens per month, BYOK, no Scout."
          active={plan === 'starter'}
          onUpgrade={() => upgrade('starter')}
        />
        <PlanCard
          name="Team"
          price="GBP 79 / month"
          description="Unlimited tokens, BYOK, optional Scout pairing."
          active={plan === 'team'}
          onUpgrade={() => upgrade('team')}
        />
      </div>
      {pending && <p className="text-sm text-text-muted">Redirecting to Stripe checkout...</p>}
    </div>
  );
}
