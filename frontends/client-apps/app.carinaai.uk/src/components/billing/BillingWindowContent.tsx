'use client';

import { useEffect, useState } from 'react';
import { BillingClient } from '@/components/billing/BillingClient';
import type { BrandedPlanOption } from '@/lib/billing-presentment';

interface BillingSummary {
  plan: string;
  productName?: string;
  dailyUsed: number;
  monthlyUsed: number;
  limit: number | null;
  period: 'day' | 'month' | 'unlimited';
  brandedPlans?: BrandedPlanOption[];
}

export function BillingWindowContent() {
  const [data, setData] = useState<BillingSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/billing/summary')
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json() as Promise<BillingSummary>;
      })
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-sm text-text-secondary">
        Failed to load billing info. Please refresh.
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 text-sm text-text-muted">Loading...</div>;
  }

  return (
    <div className="p-4">
      <BillingClient
        embedded
        plan={data.plan}
        dailyUsed={data.dailyUsed}
        monthlyUsed={data.monthlyUsed}
        limit={data.limit}
        period={data.period}
        productName={data.productName}
        brandedPlans={data.brandedPlans}
      />
    </div>
  );
}
