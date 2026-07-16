'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type PlanTier = 'starter' | 'team' | 'business';

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  reason?: 'slot_limit' | 'usage_limit' | 'trial_ended';
  currentTier?: string;
  slotLimit?: number;
};

const SLOT_LABELS: Record<PlanTier, string> = {
  starter: '1 AI employee',
  team: 'Up to 5 AI employees',
  business: 'Unlimited AI employees',
};

const PLAN_ORDER: Record<PlanTier, number> = { starter: 0, team: 1, business: 2 };

function formatPrice(pence: number | null | undefined): string {
  if (!pence) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

export function UpgradeModal({
  open,
  onClose,
  reason = 'slot_limit',
  currentTier = 'trial',
  slotLimit = 1,
}: UpgradeModalProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<PlanTier, number | null>>({
    starter: 4900,
    team: 9900,
    business: 19900,
  });

  useEffect(() => {
    if (!open) return;
    void fetch('/api/aiva/billing/pricing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const plans = (data as { plans?: Array<{ tier: string; monthlyAmountPence?: number | null }> })
          ?.plans;
        if (!plans) return;
        setPrices((prev) => {
          const next = { ...prev };
          for (const plan of plans) {
            const tier = plan.tier as PlanTier;
            if (tier in next && plan.monthlyAmountPence) {
              next[tier] = plan.monthlyAmountPence;
            }
          }
          return next;
        });
      })
      .catch(() => undefined);
  }, [open]);

  if (!open) return null;

  const normalizedTier = (['starter', 'team', 'business'].includes(currentTier)
    ? currentTier
    : 'starter') as PlanTier;
  const currentOrder = PLAN_ORDER[normalizedTier] ?? -1;
  const tierLabel = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);

  async function startCheckout(tier: PlanTier) {
    setPending(tier);
    const res = await fetch('/api/aiva/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        interval: 'month',
        successUrl: `${window.location.origin}/billing/aiva/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/billing/aiva/cancelled`,
      }),
    });
    const data = (await res.json()) as { url?: string };
    if (data.url) window.location.href = data.url;
    setPending(null);
  }

  const title =
    reason === 'trial_ended'
      ? 'Trial credit ended'
      : reason === 'usage_limit'
        ? 'Message limit reached'
        : 'You have used all included AI Employee seats.';

  const body =
    reason === 'trial_ended'
      ? 'Connect your own API key to keep using Aiva for free (self-managed), or upgrade to a managed plan from £49/mo.'
      : reason === 'usage_limit'
        ? 'You have reached your message limit on your current plan. Upgrade for a higher managed allowance.'
        : `Your plan includes ${slotLimit} AI Employee seat${slotLimit === 1 ? '' : 's'}. Add another seat from billing or upgrade your plan.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{body}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(['starter', 'team', 'business'] as const).map((tier) => {
            const isCurrent = tier === normalizedTier;
            const isUpgrade = PLAN_ORDER[tier] > currentOrder;
            const price = formatPrice(prices[tier]);

            return (
              <div
                key={tier}
                className={cn(
                  'rounded-lg border p-3',
                  tier === 'team' ? 'border-accent/40 bg-elevated' : 'border-border bg-elevated',
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">{SLOT_LABELS[tier]}</p>
                {price ? <p className="mt-2 text-sm font-semibold text-text-primary">{price}/mo</p> : null}
                {isCurrent ? (
                  <p className="mt-2 text-[10px] font-medium uppercase text-text-muted">Current plan</p>
                ) : (
                  <button
                    type="button"
                    disabled={pending !== null || !isUpgrade}
                    onClick={() => void startCheckout(tier)}
                    className={cn(
                      'mt-2 w-full rounded-md py-1.5 text-xs font-medium',
                      isUpgrade ? 'btn-primary' : 'border border-border text-text-muted',
                    )}
                  >
                    {pending === tier
                      ? 'Loading...'
                      : isUpgrade
                        ? 'Upgrade'
                        : 'Downgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          {reason === 'trial_ended' ? (
            <>
              <Link href="/settings/keys" className="underline underline-offset-2">
                Add BYOK key
              </Link>
              {' · '}
            </>
          ) : null}
          <Link href="/billing/aiva" className="underline underline-offset-2">
            Manage from billing page
          </Link>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
