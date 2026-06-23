# Sprint 5 - Prompt 02: Aiva Billing UI (app.carinaai.uk/billing/aiva)

**Sprint:** 5 - Aiva Billing
**Prompt number:** 02 of 03
**Name:** Aiva billing portal - plan cards, checkout flow, invoice history, trial management
**Primary agent:** Cursor
**Estimated hours:** 6-8 h
**Depends on:** Prompt 01 (billing backend) must be merged and deployed

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/pending_prompts/sprint-5/aiva-billing/`.

Full checklist: `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing a single line, read these files in full:

1. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx` - the existing Carina billing page; understand its structure, data fetching, and component usage
2. `frontends/client-apps/app.carinaai.uk/src/components/billing/BillingClient.tsx` - existing billing client component
3. `frontends/client-apps/app.carinaai.uk/src/components/billing/PlanCard.tsx` - existing plan card component; reuse or extend, do not duplicate
4. `frontends/client-apps/app.carinaai.uk/src/app/billing/checkout/route.ts` - existing Stripe Checkout redirect pattern; follow this for Aiva checkout
5. `frontends/client-apps/app.carinaai.uk/src/lib/core-proxy.ts` - how to call core backend
6. `frontends/client-apps/app.carinaai.uk/src/lib/session.ts` - session utilities
7. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/` - all files in this directory

---

## Context

The Aiva billing page lives at `/(workspace)/billing/aiva`. It is a separate page from the
existing Carina billing page at `/(workspace)/billing`. They are siblings. A user may have both
a Carina subscription and an Aiva subscription independently; neither page affects the other.

The sidebar navigation should have two entries under "Billing":
- "Carina plan" -> `/(workspace)/billing` (existing)
- "Aiva plan" -> `/(workspace)/billing/aiva` (new)

If both billing links are not already grouped in the sidebar, add the "Aiva plan" link below the
existing billing link without changing the existing structure.

The Aiva billing page handles:
1. Current plan display (trial countdown or active plan)
2. Plan cards with monthly/annual toggle and Stripe Checkout
3. Invoice history with PDF links
4. Customer portal link (payment method, cancellation)
5. Upgrade prompt when trial is about to expire (also shown as a modal if redirected with `?reason=trial_expired`)

---

## Step 1: Page and route structure

Create:
```
src/app/(workspace)/billing/aiva/page.tsx      Main billing page
src/app/(workspace)/billing/aiva/success/page.tsx  Post-checkout success redirect target
src/app/(workspace)/billing/aiva/cancel/page.tsx   Post-checkout cancel redirect target
src/app/api/aiva/billing/checkout/route.ts     Next.js proxy to core /api/aiva/billing/checkout
src/app/api/aiva/billing/portal/route.ts       Next.js proxy to core /api/aiva/billing/portal
src/app/api/aiva/billing/status/route.ts       Next.js proxy to core /api/aiva/billing/status
src/app/api/aiva/billing/invoices/route.ts     Next.js proxy to core /api/aiva/billing/invoices
src/app/api/aiva/billing/pricing/route.ts      Next.js proxy to core /api/aiva/billing/pricing
```

All proxy routes: require workspace session; forward workspace_id; return error on failure.
The `/pricing` route: no auth required (used to render plan cards on unauthenticated pages too).

---

## Step 2: Main billing page - `billing/aiva/page.tsx`

This is a server component that fetches subscription status and pricing config in parallel.
Pass both as props to a client component `AivaBillingClient`.

```typescript
// page.tsx (server)
const [status, pricing] = await Promise.all([
  fetchAivaSubscriptionStatus(workspaceId),
  fetchAivaPricing(),
]);
return <AivaBillingClient status={status} pricing={pricing} />;
```

**`AivaBillingClient` layout:**

Section 1: Current plan banner
Section 2: Plan cards (hidden if on Business plan and active)
Section 3: Invoice history
Section 4: Manage subscription (portal link)

---

## Step 3: Current plan banner

**Trial state** (`status.planTier === 'trial'` and `status.status === 'trialing'`):

```
[amber left border accent]
[heading] You are on a free trial
[body]    Your trial ends on [date]. You have [N] days remaining.
          Upgrade now to keep your Aiva running after [date].
[CTA]     [Choose a plan]  (scrolls to plan cards section below)
```

If `?reason=trial_expired` is in the URL (redirected from middleware), replace with:

```
[red left border]
[heading] Your trial has ended
[body]    Your Aiva has been paused. Choose a plan to reactivate it.
[CTA]     [Choose a plan]  (scrolls to plan cards)
```

**Active state** (`status.status === 'active'`):

```
[green left border]
[heading] Aiva [PlanName] - active
[body]    [N] of [slotLimit] Aivas in use.
          Current period: [currentPeriodStart] to [currentPeriodEnd].
          [Cancel at period end notice if cancel_at_period_end = true]
[CTA]     [Manage subscription]  (opens Stripe portal)
```

**Past due state** (`status.status === 'past_due'`):

```
[amber left border]
[heading] Payment failed
[body]    We couldn't collect your last payment.
          Your Aiva will continue running until [gracePeriodEndsAt].
          After that, your Aiva will be paused until payment is resolved.
[CTA]     [Update payment method]  (opens Stripe portal)
```

**Suspended state** (`status.status === 'suspended'`):

```
[red left border]
[heading] Subscription suspended
[body]    Your Aiva has been paused. Resubscribe to reactivate it.
[CTA]     [Choose a plan]  (scrolls to plan cards)
```

---

## Step 4: Plan cards

Show when `status.status` is not `'active'` on Business plan.
If the user is on an active Starter or Team plan, show the cards but mark their current plan
with a "Current plan" badge and make the other cards upgrade/downgrade CTAs.

**Monthly/annual billing toggle:**

Centered above the cards. Default: monthly. When toggled to annual:
- Show the annual price divided by 12 with a "per month, billed annually" label
- Show a savings badge: e.g., "Save 33%"

**Three plan cards** (reuse/extend the existing `PlanCard` component):

Starter:
- Name: Aiva Starter
- Subtitle: One Aiva
- Price: [monthly.amount / 100] GBP/mo or [annual.amount / 100 / 12 formatted] GBP/mo
- Features (bullet list):
  - 1 Aiva, 24/7 active
  - WhatsApp, Email, Slack, Telegram, Web chat
  - Human VA oversight included
  - Scout real-time monitoring
  - Blockchain-attested audit trail
  - 15-day money-back guarantee
- CTA: "Get started" / "Current plan" / "Downgrade"

Team:
- Name: Aiva Team
- Subtitle: Up to 5 Aivas
- Price: same pattern
- Features:
  - Everything in Starter
  - Up to 5 Aivas
  - Aiva-to-Aiva handoffs
  - Scout fleet view for all Aivas
  - Team dashboard
  - Priority support
- CTA: "Upgrade to Team" / "Current plan" / "Downgrade"
- Badge: "Most popular" (amber, positioned top-right of card)

Business:
- Name: Aiva Business
- Subtitle: White-label, unlimited Aivas
- Price: same pattern
- Features:
  - Everything in Team
  - Unlimited Aivas
  - White-label as your brand
  - Self-hosting option
  - Custom Scout governance rules
  - Custom Aiva training
  - Dedicated VA team with SLA
  - Shared Slack channel with VERLOX team
- CTA: "Upgrade to Business" / "Current plan"

**CTA click handler** (for non-current plans):

```typescript
async function handleSelectPlan(priceId: string) {
  setLoading(true);
  const res = await fetch('/api/aiva/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      successUrl: `${window.location.origin}/billing/aiva/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/billing/aiva`,
    }),
  });
  const { url } = await res.json();
  window.location.href = url;
}
```

---

## Step 5: Success and cancel pages

**`billing/aiva/success/page.tsx`:**

```
[heading]   You're on Aiva [plan name].
[subtext]   Your subscription is active. Your Aiva is running.
[body]      A receipt has been sent to [email].
[CTA row]   [Go to your Aiva]  [View invoices v]
```

Fetch subscription status on load to confirm `status.status === 'active'`. If not yet active
(webhook may not have fired), poll every 3 seconds for up to 15 seconds. Show a "Confirming
your plan..." spinner while polling. After 15 seconds, show:
"Your plan is being activated. This usually takes under a minute. Refresh to check."

**`billing/aiva/cancel/page.tsx`:**

```
[heading]   No changes made.
[subtext]   You can upgrade any time from your billing page.
[CTA]       [Back to billing]
```

---

## Step 6: Invoice history

Below the plan cards. Section heading: "Invoice history"

Table with columns: Date | Amount | Status | Plan | Download

- Date: formatted (e.g., "12 Jun 2026")
- Amount: GBP formatted (e.g., "49.00")
- Status badge: "Paid" (green), "Open" (amber), "Void" (muted)
- Plan: derived from period dates or invoice line item description
- Download: a link icon that opens `invoicePdfUrl` in a new tab

Empty state if no invoices: "No invoices yet. Your first invoice will appear here after your
first billing cycle."

Pagination: "Load more" button if more than 20 invoices (passes `limit` and `offset` to the API).

---

## Step 7: Manage subscription section

Below invoice history. Section heading: "Manage subscription"

Two actions:
- "Update payment method" - button that opens Stripe portal
- "Cancel subscription" - danger-style link that opens Stripe portal (portal handles cancellation
  with Stripe's built-in cancel flow; we do not build a custom cancel page)

Both call POST `/api/aiva/billing/portal` to get the portal URL, then redirect.

Add a small note: "Cancellations take effect at the end of your current billing period. Your
Aiva remains active until then."

---

## Step 8: Sidebar navigation update

Find the sidebar component (search for `billing` in the sidebar). Add "Aiva plan" link:

```tsx
<SidebarLink href="/billing/aiva" icon={<CreditCard size={16} />}>
  Aiva plan
</SidebarLink>
```

Position it immediately below the existing Carina billing link. Keep all existing links
unchanged.

---

## Done When

- [ ] `/(workspace)/billing/aiva` renders with current plan banner, plan cards, invoice history, manage section
- [ ] Monthly/annual toggle switches prices and updates savings badge
- [ ] Trial countdown banner shows correct days remaining with correct color for each threshold
- [ ] Trial expired state renders correctly when `?reason=trial_expired` is in the URL
- [ ] Plan card CTAs redirect to Stripe Checkout with correct price ID for selected interval
- [ ] Post-checkout success page polls for active status; shows spinner during polling
- [ ] Post-checkout cancel page renders and links back to billing
- [ ] "Manage subscription" opens Stripe portal via POST `/api/aiva/billing/portal`
- [ ] Invoice history table renders with Date, Amount, Status, Plan, Download columns
- [ ] "Load more" pagination works for invoice lists longer than 20
- [ ] Invoice PDF link opens in new tab
- [ ] Empty invoice state renders
- [ ] "Aiva plan" link in sidebar navigates to `/billing/aiva`
- [ ] All five Next.js API proxy routes exist, require session, and forward workspace_id
- [ ] No TypeScript errors
- [ ] No em dashes in any copy or JSX strings
- [ ] No emojis
- [ ] Mobile layout is usable on 375px (plan cards stack to single column)
