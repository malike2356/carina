'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PlanCard } from '@/components/billing/PlanCard';
import { UsageMeter } from '@/components/billing/UsageMeter';
import type { BrandedPlanOption } from '@/lib/billing-presentment';

export function BillingClient({
  plan,
  dailyUsed,
  monthlyUsed,
  limit,
  period,
  embedded = false,
  productName,
  brandedPlans,
}: {
  plan: string;
  dailyUsed: number;
  monthlyUsed: number;
  limit: number | null;
  period: 'day' | 'month' | 'unlimited';
  embedded?: boolean;
  productName?: string;
  brandedPlans?: BrandedPlanOption[];
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
  const plans = brandedPlans ?? [
    {
      id: 'free' as const,
      name: productName ? `${productName} Free` : 'Free',
      priceAmount: 'GBP 0',
      description: '50k tokens per day, BYOK only, 1 user.',
      active: plan === 'free',
    },
    {
      id: 'starter' as const,
      name: productName ? `${productName} Starter` : 'Starter',
      priceAmount: 'GBP 19',
      pricePeriod: 'per month',
      description: '500k tokens per month, BYOK, no Scout.',
      active: plan === 'starter',
    },
    {
      id: 'team' as const,
      name: productName ? `${productName} Team` : 'Team',
      priceAmount: 'GBP 79',
      pricePeriod: 'per month',
      description: 'Unlimited tokens, BYOK, optional Scout pairing.',
      active: plan === 'team',
    },
  ];

  return (
    <div className={cn(embedded ? 'space-y-4' : 'space-y-8')}>
      <div className={cn('rounded-xl border border-border bg-surface', embedded ? 'p-4' : 'p-6')}>
        {!embedded ? (
          <h2 className="mb-4 text-lg font-semibold">
            {productName ? `${productName} usage` : 'Usage'}
          </h2>
        ) : null}
        <UsageMeter
          label={period === 'day' ? 'Daily tokens' : period === 'month' ? 'Monthly tokens' : 'Tokens'}
          used={used}
          limit={limit}
        />
      </div>
      <div
        className={cn(
          'grid gap-4',
          embedded ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {plans.map((option) => (
          <PlanCard
            key={option.id}
            name={option.name}
            priceAmount={option.priceAmount}
            pricePeriod={option.pricePeriod}
            description={option.description}
            active={option.active}
            onUpgrade={
              option.id === 'free'
                ? undefined
                : () => upgrade(option.id as 'starter' | 'team')
            }
            compact={embedded}
          />
        ))}
      </div>
      {pending ? <p className="text-sm text-text-muted">Redirecting to Stripe checkout...</p> : null}
    </div>
  );
}
