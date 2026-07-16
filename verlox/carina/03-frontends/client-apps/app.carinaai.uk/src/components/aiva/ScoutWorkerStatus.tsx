'use client';

import { ExternalLink, Shield } from 'lucide-react';
import Link from 'next/link';
import { useProductSurface } from '@/hooks/useProductSurface';
import { billingHrefForSurface } from '@/lib/product-surface';

const SCOUT_FLEET_URL =
  process.env.NEXT_PUBLIC_SCOUT_FLEET_URL ??
  'https://console.labyrinthscout.com/dashboard';

export function ScoutWorkerStatus({
  workerId,
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

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs"
        title="Scout governance monitors this Aiva on every plan"
      >
        <Shield className="h-3.5 w-3.5 text-green-500" />
        <span className="text-text-secondary">
          {monitoring ? 'Scout monitoring active' : 'Scout paused with Aiva'}
        </span>
      </div>
      {registered ? (
        <a
          href={`${SCOUT_FLEET_URL}/agents/${workerId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost flex items-center gap-1.5 text-xs"
        >
          Fleet view <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <Link href={`${billingHref}?feature=scout`} className="text-xs text-text-muted hover:text-accent">
          Fleet sync pending
        </Link>
      )}
    </div>
  );
}
