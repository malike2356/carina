'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UsageMeter } from '@/components/billing/UsageMeter';
import {
  AIVA_BILLING_FOOTER,
  AIVA_PLANS,
  type AivaBillingInvoice,
  type AivaBillingViewModel,
  type AivaPlanDefinition,
  mapAivaBillingStatus,
  mapInvoiceRows,
  mergePlanPricing,
  paidPlanLabel,
  trialDaysRemaining,
} from '@/lib/aiva-billing-ui';
import { DunningRecoveryPanel } from '@/components/billing/aiva/DunningRecoveryPanel';
import { LivingPnLPanel } from '@/components/billing/aiva/LivingPnLPanel';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ManagePortalButton({
  label,
  variant,
  disabled,
  hasCustomer = true,
}: {
  label: string;
  variant: 'primary' | 'danger';
  disabled?: boolean;
  hasCustomer?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const portalDisabled = disabled || !hasCustomer;

  async function handleClick() {
    if (!hasCustomer) return;
    setLoading(true);
    try {
      const res = await fetch('/api/aiva/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/billing/aiva` }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading || portalDisabled}
      title={hasCustomer ? undefined : 'Contact support to manage your subscription'}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
        (loading || portalDisabled) && 'opacity-60',
      )}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}

function StatusBanner({ billing }: { billing: AivaBillingViewModel }) {
  const days = trialDaysRemaining(billing.trialEndsAt);
  const hasCustomer = Boolean(billing.stripeCustomerId);

  const config = {
    trial: {
      border: 'border-l-amber-400',
      bg: 'bg-amber-500/5 border border-amber-500/20',
      heading: 'You are on a free trial',
      body:
        days === null
          ? 'Your trial is active.'
          : days > 0
            ? `Your trial ends in ${days} day${days === 1 ? '' : 's'}. Add a plan to keep your Aivas running.`
            : 'Your trial ends today.',
      cta: { label: 'Choose a plan', variant: 'primary' as const },
    },
    active: {
      border: 'border-l-green-400',
      bg: 'bg-green-500/5 border border-green-500/20',
      heading: paidPlanLabel(billing.plan)
        ? `Your ${paidPlanLabel(billing.plan)} plan is active`
        : 'Your plan is active',
      body: billing.currentPeriodEnd
        ? `Your subscription renews on ${formatDate(billing.currentPeriodEnd)}.`
        : 'Your subscription is active. Manage renewals and payment method in Stripe.',
      cta: null,
    },
    past_due: {
      border: 'border-l-amber-400',
      bg: 'bg-amber-500/5 border border-amber-500/20',
      heading: 'Payment past due',
      body: 'Your payment method needs attention; update now to avoid interruption. Your Aivas stay active during the grace period.',
      cta: { label: 'Update payment method', variant: 'primary' as const },
    },
    suspended: {
      border: 'border-l-red-400',
      bg: 'bg-red-500/5 border border-red-500/20',
      heading: 'Account suspended',
      body: 'Your account has been suspended due to a failed payment. Your Aivas are paused until the payment is resolved.',
      cta: { label: 'Resolve payment', variant: 'danger' as const },
    },
    expired: {
      border: 'border-l-red-400',
      bg: 'bg-red-500/5 border border-red-500/20',
      heading: 'Subscription expired',
      body: 'Your subscription has ended. Choose a plan to reactivate your Aivas.',
      cta: { label: 'Reactivate', variant: 'primary' as const },
    },
    none: {
      border: 'border-l-border',
      bg: 'bg-elevated border border-border',
      heading: 'No active plan',
      body: 'Choose a plan below to get started.',
      cta: null,
    },
  }[billing.state];

  return (
    <div className={cn('rounded-lg border-l-4 p-4', config.border, config.bg)}>
      <h2 className="mb-1 text-sm font-semibold text-text-primary">{config.heading}</h2>
      <p className="mb-3 text-xs text-text-secondary">{config.body}</p>
      {billing.state === 'trial' ? (
        <a href="#choose-plan" className="btn-primary inline-block rounded-lg px-4 py-2 text-sm font-medium">
          Choose a plan
        </a>
      ) : config.cta ? (
        <ManagePortalButton
          label={config.cta.label}
          variant={config.cta.variant}
          hasCustomer={hasCustomer}
        />
      ) : null}
    </div>
  );
}

function BillingToggle({
  isAnnual,
  onChange,
}: {
  isAnnual: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'text-sm transition-colors',
          !isAnnual ? 'font-medium text-text-primary' : 'text-text-muted',
        )}
      >
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        aria-label={isAnnual ? 'Annual billing selected' : 'Monthly billing selected'}
        onClick={() => onChange(!isAnnual)}
        className={cn(
          'relative inline-flex h-6 w-11 rounded-full transition-colors focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base',
          isAnnual ? 'bg-accent' : 'border border-border bg-overlay',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            isAnnual ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span
        className={cn(
          'text-sm transition-colors',
          isAnnual ? 'font-medium text-text-primary' : 'text-text-muted',
        )}
      >
        Annual
      </span>
      {isAnnual ? (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:text-green-300">
          Save 33%
        </span>
      ) : null}
    </div>
  );
}

function PlanCta({
  plan,
  isCurrent,
  currentPlan,
  loading,
  onClick,
}: {
  plan: AivaPlanDefinition['key'];
  isCurrent: boolean;
  currentPlan: AivaPlanDefinition['key'] | null;
  loading: boolean;
  onClick: () => void;
}) {
  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-default rounded-lg border border-border bg-overlay py-2 text-sm font-medium text-text-muted"
      >
        Current plan
      </button>
    );
  }

  const order: Record<AivaPlanDefinition['key'], number> = {
    starter: 0,
    growth: 1,
    team: 1,
    business: 2,
  };
  const currentOrder = currentPlan ? order[currentPlan] : -1;
  const thisOrder = order[plan];
  const isUpgrade = thisOrder > currentOrder;
  const targetLabel = paidPlanLabel(plan) ?? plan;
  const label = currentPlan == null
    ? 'Get started'
    : isUpgrade
      ? `Upgrade to ${targetLabel}`
      : `Downgrade to ${targetLabel}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full rounded-lg py-2 text-sm font-medium transition-colors',
        isUpgrade || currentPlan == null
          ? 'btn-primary'
          : 'border border-border text-text-secondary hover:border-text-secondary hover:text-text-primary',
        loading && 'cursor-default opacity-50',
      )}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}

function PlanCard({
  plan,
  isAnnual,
  currentPlan,
  currentState,
  loadingTier,
  onCheckout,
}: {
  plan: AivaPlanDefinition;
  isAnnual: boolean;
  currentPlan: AivaPlanDefinition['key'] | null;
  currentState: AivaBillingViewModel['state'];
  loadingTier: string | null;
  onCheckout: (tier: AivaPlanDefinition['key']) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const isCurrent =
    currentPlan === plan.key && (currentState === 'active' || currentState === 'trial');
  const pricePence = isAnnual ? plan.annualMonthlyPence : plan.monthlyPence;
  const priceGbp = pricePence === null ? null : (pricePence / 100).toFixed(2).replace('.00', '');
  const isTeam = plan.key === 'team' || plan.key === 'growth';
  const isBusiness = plan.key === 'business';
  const loading = loadingTier === plan.key;
  const hasPrice = pricePence !== null;

  async function handleClick() {
    if (isCurrent) return;
    setError(null);
    try {
      await onCheckout(plan.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl p-6',
        isTeam && 'border border-accent/40 bg-elevated shadow-[0_0_0_1px_rgba(26,95,122,0.15)]',
        isBusiness && 'border border-amber-500/30 bg-amber-500/5',
        !isTeam && !isBusiness && 'border border-border bg-elevated',
      )}
    >
      {plan.badge ? (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white">
            {plan.badge}
          </span>
        </div>
      ) : null}

      <div className="mb-5">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {plan.label}
        </p>
        <p className="mb-4 text-xs text-text-muted">{plan.tagline}</p>
        <div className="flex items-baseline gap-1">
          {pricePence !== null ? (
            <>
              <p className={cn('text-3xl font-semibold', isBusiness ? 'text-amber-400' : 'text-text-primary')}>
                £{priceGbp}
              </p>
              <p className="text-sm text-text-muted">/mo</p>
            </>
          ) : (
            <p className="text-sm text-text-muted">Price set in ops</p>
          )}
        </div>
        {isAnnual && hasPrice ? <p className="mt-0.5 text-[11px] text-text-muted">billed annually</p> : null}
      </div>

      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            {feature}
          </li>
        ))}
      </ul>

      {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}

      <PlanCta
        plan={plan.key}
        isCurrent={isCurrent}
        currentPlan={currentPlan}
        loading={loading || !hasPrice}
        onClick={() => void handleClick()}
      />
    </div>
  );
}

const STATUS_BADGE: Record<
  AivaBillingInvoice['status'],
  { label: string; className: string }
> = {
  paid: { label: 'Paid', className: 'bg-green-500/15 text-green-800 dark:text-green-300' },
  open: { label: 'Open', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  void: { label: 'Void', className: 'bg-overlay text-text-muted' },
  uncollectible: { label: 'Failed', className: 'bg-red-500/15 text-red-800 dark:text-red-300' },
};

function InvoiceHistory({ invoices }: { invoices: AivaBillingInvoice[] }) {
  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-text-primary">Invoice history</h2>
      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-elevated px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">No invoices yet.</p>
          <p className="mt-1 text-xs text-text-muted">
            Paid invoices appear here after Stripe charges your subscription. You can also open full
            billing history in the Stripe customer portal.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-elevated">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Date</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-muted">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-muted">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const badge = STATUS_BADGE[invoice.status];
                const amount = new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: invoice.currency.toUpperCase(),
                }).format(invoice.amount / 100);

                return (
                  <tr
                    key={invoice.id}
                    className="group border-b border-border transition-colors last:border-0 hover:bg-overlay"
                  >
                    <td className="px-4 py-2.5 font-mono text-text-secondary">{invoice.number}</td>
                    <td className="px-4 py-2.5 text-text-muted">{formatDate(invoice.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-text-primary">{amount}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', badge.className)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {invoice.pdfUrl ? (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-end gap-1 text-[11px] text-text-muted opacity-0 transition-colors group-hover:opacity-100 hover:text-text-primary"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AivaBillingClient() {
  const searchParams = useSearchParams();
  const billingReason = searchParams.get('reason');
  const [billing, setBilling] = useState<AivaBillingViewModel | null>(null);
  const [plans, setPlans] = useState<AivaPlanDefinition[]>(AIVA_PLANS);
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    const [statusRes, invoicesRes, pricingRes] = await Promise.all([
      fetch('/api/aiva/billing/status'),
      fetch('/api/aiva/billing/invoices'),
      fetch('/api/aiva/billing/pricing'),
    ]);

    const statusPayload = statusRes.ok
      ? ((await statusRes.json()) as Record<string, unknown>)
      : null;
    const invoicePayload = invoicesRes.ok
      ? ((await invoicesRes.json()) as { invoices?: unknown[] })
      : { invoices: [] };
    const pricingPayload = pricingRes.ok
      ? ((await pricingRes.json()) as { plans?: Array<{ tier: string; monthlyAmountPence?: number | null; annualAmountPence?: number | null }> })
      : { plans: [] };

    const invoices = mapInvoiceRows(
      (invoicePayload.invoices ?? []) as Array<Record<string, unknown>>,
    );
    setBilling(mapAivaBillingStatus(statusPayload, invoices));
    setPlans(mergePlanPricing(AIVA_PLANS, pricingPayload.plans ?? []));
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  async function startCheckout(tier: AivaPlanDefinition['key']) {
    setLoadingTier(tier);
    try {
      const res = await fetch('/api/aiva/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          interval: isAnnual ? 'year' : 'month',
          successUrl: `${window.location.origin}/billing/aiva/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/billing/aiva/cancelled`,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to start checkout. Please try again.');
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoadingTier(null);
    }
  }

  if (!billing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Aiva billing</h1>
        <p className="text-sm text-text-secondary">Manage your subscription, usage, and invoices.</p>
      </div>

      <StatusBanner billing={billing} />
      <DunningRecoveryPanel />
      <LivingPnLPanel />

      {billing.state === 'active' && billingReason === 'suspended' ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm text-text-primary">
          Your subscription is active. Your Aivas have been reactivated.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-surface p-4">
        <UsageMeter
          label="Messages this month"
          used={billing.usage.messageCount}
          limit={billing.usage.messageLimit}
        />
        {billing.usage.messageLimit ? (
          <p className="mt-1 text-xs text-text-muted">
            {billing.usage.usagePercent}% used
          </p>
        ) : null}
        {billing.usage.resetsAt ? (
          <p className="mt-2 text-xs text-text-muted">Usage resets {formatDate(billing.usage.resetsAt)}</p>
        ) : null}
      </div>

      <div id="choose-plan">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {billing.plan ? 'Change plan' : 'Choose a plan'}
            </h2>
            {billing.plan ? (
              <p className="mt-1 text-xs text-text-muted">
                You are on {paidPlanLabel(billing.plan)}. Starter, Growth, and Business are listed below.
              </p>
            ) : null}
          </div>
          <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isAnnual={isAnnual}
              currentPlan={billing.plan}
              currentState={billing.state}
              loadingTier={loadingTier}
              onCheckout={startCheckout}
            />
          ))}
        </div>
      </div>

      <InvoiceHistory invoices={billing.invoices} />

      <div className="flex flex-col items-center gap-2">
        <ManagePortalButton
          label="Manage billing in Stripe"
          variant="primary"
          hasCustomer={Boolean(billing.stripeCustomerId)}
        />
        <p className="max-w-md text-center text-xs text-text-muted">
          Update payment method, download receipts, or cancel from the Stripe customer portal.
        </p>
      </div>

      <p className="text-center text-xs text-text-muted">{AIVA_BILLING_FOOTER}</p>
    </div>
  );
}
