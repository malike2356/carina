'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useProductSurface } from '@/hooks/useProductSurface';
import type { AivaSubscriptionStatus } from '@/lib/aiva-types';
import { shouldLoadAivaSubscription } from '@/lib/aiva-subscription-context';
import { dangerTone, warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';

const fetcher = (url: string) =>
  fetch(url).then((res) => (res.ok ? res.json() : null)) as Promise<AivaSubscriptionStatus | null>;

const BANNER: Record<number, { bg: string; color: string; text: string; cta: string }> = {
  3: {
    bg: cn('border-b', warnTone.boxSoft),
    color: warnTone.text,
    text: 'Your Aiva trial ends in 3 days.',
    cta: 'Choose a plan',
  },
  2: {
    bg: cn('border-b', warnTone.boxSoft),
    color: warnTone.text,
    text: '2 days left on your Aiva trial.',
    cta: 'Choose a plan',
  },
  1: {
    bg: cn('border-b', dangerTone.boxSoft),
    color: dangerTone.text,
    text: 'Last day of your Aiva trial.',
    cta: 'Choose a plan now',
  },
  0: {
    bg: cn('border-b', dangerTone.boxSoft),
    color: dangerTone.text,
    text: 'Your trial has ended. Your Aiva is paused.',
    cta: 'Reactivate',
  },
};

export function TrialBanner() {
  const pathname = usePathname();
  const surface = useProductSurface();
  const loadStatus = shouldLoadAivaSubscription(pathname, surface);

  const { data } = useSWR<AivaSubscriptionStatus | null>(
    loadStatus ? '/api/aiva/subscription/status' : null,
    fetcher,
    { refreshInterval: 60_000 },
  );
  const [dismissed, setDismissed] = useState(false);

  const days = data?.trialDaysRemaining;
  if (days == null || days > 3 || dismissed) return null;

  const cfg = BANNER[Math.max(0, Math.min(3, days))];

  return (
    <div
      className={cn(
        'relative flex h-10 shrink-0 items-center justify-center gap-3 px-4 text-xs',
        cfg.bg,
      )}
    >
      <span className={cfg.color}>{cfg.text}</span>
      <Link href="/billing/aiva" className={cn('font-semibold underline underline-offset-2', cfg.color)}>
        {cfg.cta}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
