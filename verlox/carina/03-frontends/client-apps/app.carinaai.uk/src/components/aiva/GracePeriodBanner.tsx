'use client';

import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useProductSurface } from '@/hooks/useProductSurface';
import { shouldLoadAivaSubscription } from '@/lib/aiva-subscription-context';
import { cn } from '@/lib/utils';

type BillingStatus = {
  subscription?: {
    status?: string;
    gracePeriodEndsAt?: string | null;
  };
};

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : null)) as Promise<BillingStatus | null>;

export function GracePeriodBanner() {
  const pathname = usePathname();
  const surface = useProductSurface();
  const loadStatus = shouldLoadAivaSubscription(pathname, surface);

  const { data } = useSWR<BillingStatus | null>(
    loadStatus ? '/api/aiva/billing/status' : null,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const sub = data?.subscription;
  if (!sub || sub.status !== 'past_due' || !sub.gracePeriodEndsAt) return null;

  const ends = new Date(sub.gracePeriodEndsAt);
  const daysLeft = Math.ceil((ends.getTime() - Date.now()) / 86_400_000);
  const endsLabel = ends.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const urgent = daysLeft <= 2;
  const expiresToday = daysLeft <= 0;

  async function openPortal() {
    const res = await fetch('/api/aiva/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: `${window.location.origin}/billing/aiva` }),
    });
    const body = (await res.json()) as { url?: string };
    if (body.url) window.location.href = body.url;
  }

  return (
    <div
      className={cn(
        'flex h-auto min-h-10 shrink-0 items-center justify-center border-b px-4 py-2 text-xs',
        expiresToday
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : urgent
            ? 'border-amber-500/30 bg-amber-500/15 text-amber-200'
            : 'border-amber-500/25 bg-amber-500/10 text-amber-300',
      )}
    >
      <span className="text-center">
        Payment failed. Update your payment method to keep your Aiva running.{' '}
        {expiresToday ? (
          <strong>Your Aiva will pause today unless payment is resolved.</strong>
        ) : urgent ? (
          <>
            Your Aiva will pause in <strong>{Math.max(daysLeft, 1)} day(s)</strong> on {endsLabel}.
          </>
        ) : (
          <>Your Aiva will pause on {endsLabel}.</>
        )}{' '}
        <button
          type="button"
          onClick={() => void openPortal()}
          className="font-semibold underline underline-offset-2"
        >
          Update payment method
        </button>
      </span>
    </div>
  );
}
