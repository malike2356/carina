'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

export function AivaSuspendedGate({ children }: { children: ReactNode }) {
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/aiva/subscription/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const status = String((data as { status?: string })?.status ?? '');
        setSuspended(status === 'suspended');
      })
      .catch(() => setSuspended(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return children;

  if (suspended) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Your Aiva subscription is suspended.</h1>
        <p className="mt-3 max-w-md text-sm text-text-secondary">
          Your Aiva has been paused. To reactivate, choose a plan on the billing page.
        </p>
        <Link href="/billing/aiva?reason=suspended" className="btn-primary mt-6 rounded-lg px-4 py-2 text-sm">
          Go to billing
        </Link>
      </div>
    );
  }

  return children;
}
