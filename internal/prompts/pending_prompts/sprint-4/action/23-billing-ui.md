# Sprint 4 - Prompt 23: Billing UI

**Sprint:** 4
**Prompt number:** 23
**Primary agent:** Cursor
**Estimated hours:** 6-8 h
**Depends on:** 22-billing-backend.md (Stripe integration and billing API routes); 10-worker-portal-ui.md (workspace nav and layout); 08-workspace-auth.md (auth session)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

1. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx` - current billing page; you are rewriting this
2. `frontends/client-apps/app.carinaai.uk/src/components/billing/` - existing billing components if any; check before creating new ones
3. `frontends/client-apps/app.carinaai.uk/src/app/api/billing/` - Next.js proxy routes from prompt 22; know the exact URLs you are calling
4. `frontends/client-apps/app.carinaai.uk/src/app/globals.css` - confirm the utility class names (`btn-primary`, design tokens, etc.) established in prompt 10

---

## Context

The billing page is the workspace owner's view of their subscription. It shows their current plan
status (including trial countdown), a comparison of available plans, an upgrade/downgrade flow via
Stripe Checkout, and invoice history. The URL is `/billing`.

Plan names: Starter, Team, Business. The monthly prices are set in the backend. This prompt handles
only the UI; all Stripe logic is in prompt 22.

---

## Step 1: Route and page structure

The billing page lives at `src/app/(workspace)/billing/page.tsx`. It is a server component that
fetches the current billing status, then hands off to `BillingClient.tsx`.

```tsx
// billing/page.tsx
export default async function BillingPage() {
  const session = await getWorkspaceSession();  // existing auth helper
  const res = await fetch(`${process.env.CORE_API_URL}/api/billing/status`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });
  const billing: BillingStatus = res.ok ? await res.json() : null;

  return <BillingClient initial={billing} />;
}
```

`BillingStatus` type:
```typescript
interface BillingStatus {
  state: 'trial' | 'active' | 'past_due' | 'suspended' | 'expired' | 'none';
  plan: 'starter' | 'team' | 'business' | null;
  trialEndsAt: string | null;   // ISO date; non-null only when state='trial'
  currentPeriodEnd: string | null;
  invoices: Invoice[];
}

interface Invoice {
  id: string;
  number: string;
  amount: number;      // pence
  currency: string;    // 'gbp'
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  createdAt: string;
  pdfUrl: string | null;
}
```

---

## Step 2: `BillingClient.tsx` - top-level layout

```tsx
'use client';

export function BillingClient({ initial }: { initial: BillingStatus | null }) {
  const [billing, setBilling] = useState(initial);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Status banner */}
      {billing && <StatusBanner billing={billing} />}

      {/* Section: Choose a plan */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-text-primary">Choose a plan</h2>
          <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
        </div>
        <PlanGrid billing={billing} isAnnual={isAnnual} onBillingChange={setBilling} />
      </div>

      {/* Section: Invoices */}
      {billing?.invoices && billing.invoices.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-4">Invoice history</h2>
          <InvoiceTable invoices={billing.invoices} />
        </div>
      )}
    </div>
  );
}
```

---

## Step 3: `StatusBanner` component

The banner is a full-width card with a 4px left border that changes color by state.
It appears above the plan grid.

```tsx
const BANNER_CONFIG: Record<BillingStatus['state'], {
  borderColor: string;
  bgColor: string;
  borderClass: string;
  heading: string;
  body: (billing: BillingStatus) => string;
  ctaLabel: string;
  ctaVariant: 'primary' | 'danger' | 'none';
}> = {
  trial: {
    borderColor: 'border-l-amber-400',
    bgColor: 'bg-amber-500/5',
    borderClass: 'border border-amber-500/20',
    heading: 'You are on a free trial',
    body: (b) => {
      if (!b.trialEndsAt) return 'Your trial is active.';
      const days = Math.ceil((new Date(b.trialEndsAt).getTime() - Date.now()) / 86400000);
      return days > 0 ? `Your trial ends in ${days} day${days === 1 ? '' : 's'}. Add a plan to keep your Aivas running.` : 'Your trial ends today.';
    },
    ctaLabel: 'Choose a plan',
    ctaVariant: 'primary',
  },
  active: {
    borderColor: 'border-l-green-400',
    bgColor: 'bg-green-500/5',
    borderClass: 'border border-green-500/20',
    heading: 'Your plan is active',
    body: (b) => b.currentPeriodEnd
      ? `Your subscription renews on ${format(new Date(b.currentPeriodEnd), 'd MMM yyyy')}.`
      : 'Your subscription is active.',
    ctaLabel: '',
    ctaVariant: 'none',
  },
  past_due: {
    borderColor: 'border-l-amber-400',
    bgColor: 'bg-amber-500/5',
    borderClass: 'border border-amber-500/20',
    heading: 'Payment past due',
    body: () => 'Your last payment failed. Update your payment method to keep your Aivas active.',
    ctaLabel: 'Update payment method',
    ctaVariant: 'primary',
  },
  suspended: {
    borderColor: 'border-l-red-400',
    bgColor: 'bg-red-500/5',
    borderClass: 'border border-red-500/20',
    heading: 'Account suspended',
    body: () => 'Your account has been suspended due to a failed payment. Your Aivas are paused until the payment is resolved.',
    ctaLabel: 'Resolve payment',
    ctaVariant: 'danger',
  },
  expired: {
    borderColor: 'border-l-red-400',
    bgColor: 'bg-red-500/5',
    borderClass: 'border border-red-500/20',
    heading: 'Subscription expired',
    body: () => 'Your subscription has ended. Choose a plan to reactivate your Aivas.',
    ctaLabel: 'Reactivate',
    ctaVariant: 'primary',
  },
  none: {
    borderColor: 'border-l-border',
    bgColor: 'bg-elevated',
    borderClass: 'border border-border',
    heading: 'No active plan',
    body: () => 'Choose a plan below to get started.',
    ctaLabel: '',
    ctaVariant: 'none',
  },
};

function StatusBanner({ billing }: { billing: BillingStatus }) {
  const config = BANNER_CONFIG[billing.state];
  const body = config.body(billing);

  return (
    <div className={cn(
      'rounded-lg border-l-4 p-4',
      config.borderColor,
      config.bgColor,
      config.borderClass,
    )}>
      <h2 className="text-sm font-semibold text-text-primary mb-1">{config.heading}</h2>
      <p className="text-xs text-text-secondary mb-3">{body}</p>
      {config.ctaVariant !== 'none' && (
        <ManagePortalButton label={config.ctaLabel} variant={config.ctaVariant} />
      )}
    </div>
  );
}
```

`ManagePortalButton` calls `POST /api/billing/portal` and redirects to the returned Stripe portal URL:
```tsx
function ManagePortalButton({ label, variant }: { label: string; variant: 'primary' | 'danger' }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'text-sm px-4 py-2 rounded-lg font-medium transition-colors',
        variant === 'primary' && 'btn-primary',
        variant === 'danger'  && 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
      )}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}
```

---

## Step 4: `BillingToggle` - monthly/annual switch

```tsx
function BillingToggle({ isAnnual, onChange }: { isAnnual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-sm transition-colors', !isAnnual ? 'text-text-primary font-medium' : 'text-text-muted')}>
        Monthly
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        onClick={() => onChange(!isAnnual)}
        className={cn(
          'relative inline-flex h-6 w-11 rounded-full transition-colors focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base',
          isAnnual ? 'bg-accent' : 'bg-overlay border border-border',
        )}
      >
        <span className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          isAnnual ? 'translate-x-5' : 'translate-x-0.5',
        )} />
      </button>

      <span className={cn('text-sm transition-colors', isAnnual ? 'text-text-primary font-medium' : 'text-text-muted')}>
        Annual
      </span>

      {isAnnual && (
        <span className="text-[11px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
          Save 33%
        </span>
      )}
    </div>
  );
}
```

---

## Step 5: `PlanGrid` - plan cards

Three cards in `grid grid-cols-1 md:grid-cols-3 gap-4`.

**Card border treatment by plan:**
- Starter: `border border-border` (neutral)
- Team: `border border-accent/40 shadow-[0_0_0_1px_rgba(26,95,122,0.15)]` (accent highlight)
- Business: `border border-amber-500/30 bg-amber-500/5` (amber, business tier)

```tsx
const PLANS: Array<{
  key: 'starter' | 'team' | 'business';
  label: string;
  tagline: string;
  monthlyPence: number;
  annualMonthlyPence: number;
  features: string[];
  badge?: string;
}> = [
  {
    key: 'starter',
    label: 'Starter',
    tagline: 'One Aiva, always on',
    monthlyPence: 2900,
    annualMonthlyPence: 1933,
    features: [
      '1 Aiva worker',
      '2 channels (web + 1)',
      '500 conversations / mo',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    key: 'team',
    label: 'Team',
    tagline: 'Multiple Aivas, full visibility',
    monthlyPence: 7900,
    annualMonthlyPence: 5267,
    badge: 'Most popular',
    features: [
      '5 Aiva workers',
      'All channels',
      '5,000 conversations / mo',
      'Full analytics + heatmap',
      'VA escalation queue',
      'Priority support',
    ],
  },
  {
    key: 'business',
    label: 'Business',
    tagline: 'Custom scale, dedicated support',
    monthlyPence: 19900,
    annualMonthlyPence: 13267,
    features: [
      'Unlimited Aiva workers',
      'All channels',
      'Unlimited conversations',
      'White-label widget',
      'On-chain attestation export',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
];

function PlanGrid({ billing, isAnnual, onBillingChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((plan) => (
        <PlanCard
          key={plan.key}
          plan={plan}
          isAnnual={isAnnual}
          currentPlan={billing?.plan ?? null}
          currentState={billing?.state ?? 'none'}
          onBillingChange={onBillingChange}
        />
      ))}
    </div>
  );
}
```

**`PlanCard` component:**

```tsx
function PlanCard({ plan, isAnnual, currentPlan, currentState, onBillingChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCurrent = currentPlan === plan.key && (currentState === 'active' || currentState === 'trial');

  const pricePence = isAnnual ? plan.annualMonthlyPence : plan.monthlyPence;
  const priceGbp = (pricePence / 100).toFixed(2).replace('.00', '');

  const isTeam = plan.key === 'team';
  const isBusiness = plan.key === 'business';

  async function handleClick() {
    if (isCurrent) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.key, interval: isAnnual ? 'annual' : 'monthly' }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message ?? 'Failed to start checkout. Please try again.');
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn(
      'relative rounded-xl p-6 flex flex-col',
      isTeam     && 'border border-accent/40 bg-elevated shadow-[0_0_0_1px_rgba(26,95,122,0.15)]',
      isBusiness && 'border border-amber-500/30 bg-amber-500/5',
      !isTeam && !isBusiness && 'border border-border bg-elevated',
    )}>
      {/* "Most popular" badge - vertically centered above the card top edge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="text-[11px] font-semibold bg-accent text-white px-3 py-1 rounded-full whitespace-nowrap">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-0.5">
          {plan.label}
        </p>
        <p className="text-xs text-text-muted mb-4">{plan.tagline}</p>
        <div className="flex items-baseline gap-1">
          <p className={cn(
            'text-3xl font-semibold',
            isBusiness ? 'text-amber-400' : 'text-text-primary',
          )}>
            £{priceGbp}
          </p>
          <p className="text-sm text-text-muted">/mo</p>
        </div>
        {isAnnual && (
          <p className="text-[11px] text-text-muted mt-0.5">billed annually</p>
        )}
      </div>

      {/* Feature list */}
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
            <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      {/* Error message */}
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {/* CTA button */}
      <PlanCta
        plan={plan.key}
        isCurrent={isCurrent}
        currentPlan={currentPlan}
        loading={loading}
        onClick={handleClick}
      />
    </div>
  );
}
```

**`PlanCta` - CTA button logic:**

```tsx
function PlanCta({ plan, isCurrent, currentPlan, loading, onClick }) {
  if (isCurrent) {
    return (
      <button disabled className="w-full rounded-lg border border-border bg-overlay text-text-muted
                                  text-sm font-medium py-2 cursor-default">
        Current plan
      </button>
    );
  }

  const PLAN_ORDER = { starter: 0, team: 1, business: 2 };
  const currentOrder  = currentPlan ? PLAN_ORDER[currentPlan] : -1;
  const thisOrder     = PLAN_ORDER[plan];
  const isUpgrade     = thisOrder > currentOrder;
  const label         = currentPlan == null
    ? 'Get started'
    : isUpgrade
      ? `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
      : 'Downgrade';

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full rounded-lg text-sm font-medium py-2 transition-colors',
        isUpgrade || currentPlan == null
          ? 'btn-primary'
          : 'border border-border text-text-secondary hover:border-text-secondary hover:text-text-primary',
        loading && 'opacity-50 cursor-default',
      )}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}
```

---

## Step 6: Success page - checkout return

Create `src/app/(workspace)/billing/success/page.tsx`.

Stripe redirects to `/billing/success?session_id=...` after a successful checkout. The page polls
the billing status endpoint until `state === 'active'` (or up to 15 seconds), then shows a
confirmation.

```tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'polling' | 'confirmed' | 'timeout'>('polling');
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) { router.replace('/billing'); return; }

    let attempts = 0;
    const maxAttempts = 15;

    async function poll() {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        const data: BillingStatus = await res.json();
        if (data.state === 'active' && data.plan) {
          setPlanName(data.plan.charAt(0).toUpperCase() + data.plan.slice(1));
          setStatus('confirmed');
          return;
        }
      }
      attempts++;
      if (attempts >= maxAttempts) {
        setStatus('timeout');
        return;
      }
      setTimeout(poll, 1000);
    }

    poll();
  }, [searchParams, router]);

  if (status === 'polling') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {/* Spinner */}
        <div className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
        <p className="text-sm text-text-secondary">Confirming your plan...</p>
        <p className="text-xs text-text-muted mt-1">This takes a moment.</p>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-sm text-text-secondary mb-2">Your payment was received.</p>
        <p className="text-xs text-text-muted mb-4">
          Your plan may take a moment to activate. Check your billing page in a few seconds.
        </p>
        <a href="/billing" className="btn-primary text-sm px-4 py-2 rounded-lg">
          Back to billing
        </a>
      </div>
    );
  }

  // status === 'confirmed'
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
        <Check className="h-7 w-7 text-green-400" />
      </div>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        You are on Aiva {planName}.
      </h1>
      <p className="text-sm text-text-secondary mb-6 max-w-xs">
        Your Aivas are now live. Head to the Aiva roster to check their status.
      </p>
      <div className="flex gap-3">
        <a href="/aiva/workers" className="btn-primary text-sm px-4 py-2 rounded-lg">
          View Aivas
        </a>
        <a href="/billing" className="text-sm px-4 py-2 rounded-lg border border-border
                                      text-text-secondary hover:bg-elevated transition-colors">
          View billing
        </a>
      </div>
    </div>
  );
}
```

---

## Step 7: `InvoiceTable` component

```tsx
const STATUS_BADGE: Record<Invoice['status'], { label: string; className: string }> = {
  paid:           { label: 'Paid',   className: 'bg-green-500/15 text-green-400' },
  open:           { label: 'Open',   className: 'bg-amber-500/15 text-amber-400' },
  void:           { label: 'Void',   className: 'bg-overlay text-text-muted' },
  uncollectible:  { label: 'Failed', className: 'bg-red-500/15 text-red-400' },
};

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="rounded-lg border border-border bg-elevated overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-text-muted font-medium">Invoice</th>
            <th className="text-left px-4 py-2.5 text-text-muted font-medium">Date</th>
            <th className="text-right px-4 py-2.5 text-text-muted font-medium">Amount</th>
            <th className="text-left px-4 py-2.5 text-text-muted font-medium">Status</th>
            <th className="px-4 py-2.5" /> {/* PDF download column */}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const badge = STATUS_BADGE[invoice.status];
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: invoice.currency.toUpperCase(),
  }).format(invoice.amount / 100);

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-overlay transition-colors">
      <td className="px-4 py-2.5 font-mono text-text-secondary">{invoice.number}</td>
      <td className="px-4 py-2.5 text-text-muted">{format(new Date(invoice.createdAt), 'd MMM yyyy')}</td>
      <td className="px-4 py-2.5 text-right text-text-primary font-medium">{amount}</td>
      <td className="px-4 py-2.5">
        <span className={cn('text-[11px] px-2 py-0.5 rounded font-medium', badge.className)}>
          {badge.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-text-muted hover:text-text-primary transition-colors
                       opacity-0 group-hover:opacity-100 flex items-center gap-1 justify-end"
          >
            <Download className="h-3 w-3" />
            PDF
          </a>
        )}
      </td>
    </tr>
  );
}
```

The PDF download link uses `group/group-hover:opacity-100` so it is invisible until the row
is hovered, keeping the table visually clean.

---

## Step 8: Stripe cancel URL

Create `src/app/(workspace)/billing/cancelled/page.tsx`:

```tsx
export default function BillingCancelledPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-sm text-text-secondary mb-4">
        Checkout cancelled. No charge was made.
      </p>
      <a href="/billing" className="btn-primary text-sm px-4 py-2 rounded-lg">
        Back to billing
      </a>
    </div>
  );
}
```

---

## Done When

**Page structure:**
- [ ] `/billing` page renders without errors for all six `billing.state` values
- [ ] `/billing/success` page polls correctly; shows spinner during polling, success UI on confirmation, timeout message after 15 seconds
- [ ] `/billing/cancelled` page exists and links back to `/billing`
- [ ] All pages are within the `(workspace)` layout group so the sidebar renders

**StatusBanner:**
- [ ] All six states render the correct heading, body text, and left-border color
- [ ] Trial banner shows correct days remaining; handles 0 days and null trialEndsAt
- [ ] "Manage" CTA buttons call `/api/billing/portal` and redirect to the returned URL
- [ ] Suspended state CTA uses the danger button style (border-red-500/40 text-red-400)

**BillingToggle:**
- [ ] Toggle is a proper `role="switch"` button
- [ ] "Save 33%" badge appears only when annual is selected
- [ ] Monthly/Annual labels update text weight when active
- [ ] Toggle thumb slides with a CSS transition (duration-200)

**PlanGrid:**
- [ ] Three cards in a responsive grid (1 col on mobile, 3 on md+)
- [ ] Starter: neutral border, bg-elevated
- [ ] Team: accent border + accent shadow + "Most popular" badge centered above top edge
- [ ] Business: amber border, amber background tint, amber price color
- [ ] Feature list uses Check icon (not an emoji or bullet)
- [ ] "Current plan" button: disabled, muted style
- [ ] Upgrade button: `btn-primary` style
- [ ] Downgrade button: neutral border style
- [ ] "Get started" used when no current plan
- [ ] Price updates immediately when toggle changes
- [ ] "billed annually" note shown below price only in annual mode
- [ ] Error message shown inline below feature list on checkout error
- [ ] Loading state disables button and shows "Loading..."

**InvoiceTable:**
- [ ] Four status badges with correct colors: Paid=green, Open=amber, Void=muted, Failed=red
- [ ] Amount formatted as GBP currency string
- [ ] Date formatted as "d MMM yyyy"
- [ ] PDF download link visible only on row hover (group-hover pattern)
- [ ] Table hidden entirely when no invoices

**General:**
- [ ] No em dashes in any copy, labels, or comments
- [ ] No emojis; lucide-react icons only (Check, Download)
- [ ] `btn-primary` class comes from globals.css; do not redefine it in this file
