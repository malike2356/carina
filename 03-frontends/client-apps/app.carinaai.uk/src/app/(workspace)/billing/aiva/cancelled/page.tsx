'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CancelledContent() {
  const searchParams = useSearchParams();
  const trialExpired = searchParams.get('reason') === 'trial_expired';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-text-primary">No charge was made</h1>
      <p className="mb-6 max-w-md text-sm text-text-secondary">
        {trialExpired
          ? 'You left the payment page before completing. Your trial has ended. Choose a plan to reactivate your Aiva.'
          : 'You left the payment page before completing. Your trial is still running.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/billing/aiva" className="btn-primary rounded-lg px-4 py-2 text-sm">
          Choose a plan
        </Link>
        <Link
          href="/aiva"
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-elevated"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  );
}

export default function AivaBillingCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}
