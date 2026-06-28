'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useProductSurface } from '@/hooks/useProductSurface';
import { billingHrefForSurface } from '@/lib/product-surface';

const PLAN_ORDER: Record<string, number> = { trial: 0, starter: 1, team: 2, business: 3 };

export function PlanGateSection({
  planRequired,
  currentPlan,
  children,
}: {
  planRequired: 'business' | 'team';
  currentPlan: string;
  children: ReactNode;
}) {
  const surface = useProductSurface();
  const billingHref = billingHrefForSurface(surface);
  const sufficient = (PLAN_ORDER[currentPlan] ?? 0) >= (PLAN_ORDER[planRequired] ?? 0);
  if (sufficient) return <section className="space-y-3">{children}</section>;

  return (
    <section className="relative space-y-3">
      <div className="pointer-events-none select-none blur-sm opacity-30" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-4 py-2.5 shadow-sm">
          <Lock className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <p className="text-xs text-text-secondary">
            Available on the{' '}
            <Link href={billingHref} className="font-medium text-accent hover:underline">
              {planRequired.charAt(0).toUpperCase() + planRequired.slice(1)} plan
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
