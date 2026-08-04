'use client';

import { Suspense } from 'react';
import { AivaBillingClient } from '@/components/billing/aiva/AivaBillingClient';

export default function AivaBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <AivaBillingClient />
    </Suspense>
  );
}
