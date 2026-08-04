'use client';

import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useProductSurface } from '@/hooks/useProductSurface';
import { billingHrefForSurface } from '@/lib/product-surface';

export function ScoutWorkerStatus({
  scout,
}: {
  workerId: string;
  scout?: {
    enabled?: boolean;
    registered?: boolean;
    monitoring?: boolean;
  };
}) {
  const surface = useProductSurface();
  const billingHref = billingHrefForSurface(surface);
  const enabled = scout?.enabled !== false;
  const registered = scout?.registered === true;
  const monitoring = scout?.monitoring !== false;

  if (!enabled) {
    return (
      <span className="text-xs text-text-muted" title="Scout fleet monitoring is not enabled on this environment">
        Scout unavailable
      </span>
    );
  }

  const statusLabel = monitoring ? 'Scout monitoring active' : 'Scout paused with Aiva';

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
      <div
        className="flex max-w-full items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1.5 text-xs sm:px-2.5"
        title={statusLabel}
      >
        <Shield className="h-3.5 w-3.5 shrink-0 text-green-500" />
        <span className="hidden text-text-secondary sm:inline">{statusLabel}</span>
        <span className="text-text-secondary sm:hidden">
          {monitoring ? 'Scout on' : 'Scout paused'}
        </span>
      </div>
      {!registered ? (
        <Link href={`${billingHref}?feature=scout`} className="text-xs text-text-muted hover:text-accent">
          Fleet pending
        </Link>
      ) : null}
    </div>
  );
}
