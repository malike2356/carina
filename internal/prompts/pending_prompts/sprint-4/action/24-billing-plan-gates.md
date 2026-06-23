# Sprint 5 - Prompt 03: Plan Gates and Upgrade Flows

**Sprint:** 5 - Aiva Billing
**Prompt number:** 03 of 03
**Name:** Slot limit enforcement, upgrade prompts, downgrade resolution, suspension handling
**Primary agent:** Cursor (middleware + UI) + Claude Code (backend enforcement)
**Estimated hours:** 6-8 h
**Depends on:** Prompt 01 (billing backend) must be merged and deployed

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-5/aiva-billing/`.

Full checklist: `internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

---

## Read First

Before writing a single line, read these files in full:

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - the core Aiva API; plan gate (`canHireMore`) is already returned in slot check but the 402 response may not be wired yet
2. `backends/servers/core.carinaai.uk/src/billing/aiva-billing.ts` - `canHireMoreAivas()` and `slotLimitForTier()` built in prompt 01; use these, do not reimplement
3. `frontends/client-apps/app.carinaai.uk/src/middleware.ts` - the existing middleware extended in sprint-4 prompt 04; you will extend it further here
4. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/page.tsx` - the hire page; you will add the upgrade modal to this page
5. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/aiva/page.tsx` - the billing page built in prompt 02; link to it from all upgrade prompts
6. `frontends/client-apps/app.carinaai.uk/src/app/api/aiva/workers/route.ts` - the proxy that calls POST `/api/aiva/workers`; you need to handle the 402 response

---

## Context

Sprint-4 built the Aiva create/manage flow. Sprint-5 prompt 01 built the billing backend.
Sprint-5 prompt 02 built the billing UI. This prompt connects enforcement to the UI.

The three places where plan limits are enforced:

1. Backend (aiva-api.ts): POST `/api/aiva/workers` returns 402 when slot limit is reached
2. Middleware (middleware.ts): `/aiva` page shows an upgrade wall when `canHireMore = false`
3. UI (hire page): upgrade modal appears when the POST returns 402

Suspension flow:
- After trial expiry or payment failure grace period, `status = 'suspended'`
- All `/aiva/*` routes redirect to `/billing/aiva?reason=suspended`
- Workspace chat (`/chat/*`) still works; only the Aiva management routes are blocked

Downgrade conflict:
- When a user downgrades from Team (5 slots) to Starter (1 slot) with 3 Aivas active:
  `pending_downgrade_conflict = true` on the workspace
- On next visit to `/aiva`, they see a conflict resolution screen instead of the normal page

---

## Step 1: Backend - 402 enforcement in aiva-api.ts

In `aiva-api.ts`, inside the POST `/api/aiva/workers` handler, call `canHireMoreAivas(workspaceId)` before creating the worker. If it returns false:

```typescript
return res.status(402).json({
  error: 'aiva_slot_limit_reached',
  message: 'You have reached your Aiva slot limit. Upgrade your plan to hire more Aivas.',
  upgradeUrl: `${process.env.APP_URL}/billing/aiva`,
  currentTier: subscription.plan_tier,
  slotLimit: subscription.aiva_slot_limit,
  aivasUsed: aivasUsed,
});
```

This 402 block must execute before any DB write. If `aiva_slot_limit = 999` (Business tier),
skip the check entirely for performance.

---

## Step 2: Next.js API proxy - handle 402 from backend

In `frontends/client-apps/app.carinaai.uk/src/app/api/aiva/workers/route.ts`:

When the core backend returns 402, forward the 402 to the client with the full JSON body.
Do not swallow it or convert it to a 500. The client component reads the `error` field to
decide whether to show the upgrade modal.

```typescript
if (coreRes.status === 402) {
  const body = await coreRes.json();
  return NextResponse.json(body, { status: 402 });
}
```

---

## Step 3: Upgrade modal on the hire page

In `src/app/(workspace)/aiva/page.tsx` (or its client component), handle the 402 response from
POST `/api/aiva/workers`:

```typescript
const res = await fetch('/api/aiva/workers', { method: 'POST', ... });
if (res.status === 402) {
  const body = await res.json();
  if (body.error === 'aiva_slot_limit_reached') {
    setUpgradeModal({ open: true, currentTier: body.currentTier, slotLimit: body.slotLimit });
    return;
  }
}
```

Create `src/components/aiva/UpgradeModal.tsx`:

```
[Modal overlay]
[heading]   You've used all your Aiva slots.
[subtext]   You are on Aiva [currentTierLabel]. Your plan includes [slotLimit] Aiva(s).
            Upgrade to hire more Aivas.

[Three plan cards - compact version]
  Starter  |  Team (highlight if current)  |  Business
  1 Aiva   |  5 Aivas                      |  Unlimited
  49/mo    |  199/mo                       |  499/mo
  [Current plan badge on current tier]
  [Upgrade button on higher tiers, disabled on current and lower]

[small link] Manage from billing page -> /billing/aiva
[Cancel button]
```

The plan cards in the modal are compact (no feature list, just name, slot count, price, CTA).
Clicking an upgrade CTA calls POST `/api/aiva/billing/checkout` with the monthly price ID for
that tier and redirects to Stripe Checkout.

---

## Step 4: Middleware - suspension redirect

Extend `src/middleware.ts`:

For any authenticated request to `/(workspace)/aiva/*` or `/api/aiva/*` (non-webhook):

1. Read `aiva_plan_status` from the signed session cookie (set by the subscription status check
   in sprint-4 prompt 04's middleware). If the cookie does not exist, skip the check (let the
   page load; the page will fetch status on mount and handle it).

2. If cookie value is `suspended`:
   - For page routes: redirect to `/billing/aiva?reason=suspended`
   - For API routes: return 402 with `{ error: 'aiva_suspended', upgradeUrl: '/billing/aiva' }`

3. If cookie value is `trial_expired`:
   - Same as suspended (redirect or 402)

4. For requests to `/(workspace)/chat/*` or `/api/chat/*`: do NOT apply this check. Workspace
   chat must remain accessible regardless of Aiva subscription status.

**Cookie refresh:** After a successful Stripe payment, the `aiva_plan_status` cookie must be
cleared so the next request re-fetches subscription status. Clear it in the success callback on
the billing page (`/billing/aiva/success/page.tsx`) by calling GET `/api/aiva/billing/status`
and writing the result back to the cookie.

---

## Step 5: Suspended state UI

When a user reaches `/billing/aiva?reason=suspended`, the billing page (built in prompt 02)
already handles the `suspended` banner state. No new page is needed.

However, add a second suspended state for users who are suspended and have not visited the
billing page yet. If they navigate directly to `/aiva` (bypassing middleware cache) and the
status loads as suspended:

Show a full-page overlay on `/aiva` (not a modal, but a full replacement of the page content):

```
[heading]   Your Aiva subscription is suspended.
[subtext]   Your Aiva has been paused. To reactivate, choose a plan below.
[CTA]       [Go to billing]  -> /billing/aiva
```

This is a fallback; the middleware redirect in Step 4 should catch most cases.

---

## Step 6: Grace period banner

Create `src/components/aiva/GracePeriodBanner.tsx`.

Show at the top of all `/(workspace)/aiva/*` pages when `status.status === 'past_due'` and
`status.gracePeriodEndsAt` is set.

```
[amber background banner, not dismissible]
Payment failed. Update your payment method to keep your Aiva running.
Your Aiva will pause on [gracePeriodEndsAt date]. [Update payment method ->]
```

"Update payment method" calls POST `/api/aiva/billing/portal` and redirects.

Calculate the days remaining from `gracePeriodEndsAt`:
- >= 3 days: amber, no urgency modifier
- <= 2 days: amber, "in X days" in bold
- 0 days (expiry day): red, "Your Aiva will pause today unless payment is resolved."

Do not reuse the TrialBanner component; this is a different warning with different logic.
Do not make this banner dismissible. Payment failures require immediate attention.

---

## Step 7: Downgrade conflict resolution screen

When `pending_downgrade_conflict = true` on the workspace subscription row, the user has
scheduled a downgrade to a lower tier but has more active Aivas than the new tier allows.

**Detection:** The `GET /api/aiva/billing/status` response includes `pendingDowngradeConflict: boolean` and `pendingDowngradeTier: 'starter' | 'team' | null` and `pendingDowngradeSlotLimit: number`.

**Screen trigger:** On the `/aiva` page (the Aivas list view), if `pendingDowngradeConflict` is
true, replace the normal page content with the conflict resolution screen. Do not render the
hire form or Aiva cards.

**Conflict resolution screen** (`src/components/aiva/DowngradeConflictScreen.tsx`):

```
[heading]   Action needed before your plan change.
[subtext]   You are moving to Aiva [newTierLabel], which includes [pendingDowngradeSlotLimit] Aiva(s).
            You currently have [aivasUsed] active Aiva(s).
            Please choose which Aiva(s) to keep. The rest will be paused.

[List of all active Aivas - each row:]
  [checkbox] [Aiva name] [role label] [active since date] [last active time ago]

[Below list:]
  "Select [pendingDowngradeSlotLimit] to keep."
  Counter: [N selected] of [pendingDowngradeSlotLimit] allowed.

[CTA - enabled only when selection count = pendingDowngradeSlotLimit]
  [Confirm and keep selected Aivas]
```

On confirm, call:

```
POST /api/aiva/billing/resolve-downgrade
Body: { keepWorkerIds: string[] }
```

This route must be added to the billing API (Step 9 below). On success, redirect to `/aiva`
with a success toast: "Your plan has been updated. The unselected Aivas have been paused."

If the user tries to navigate away before resolving the conflict, the middleware should not
block them (the conflict is resolved at period end, not immediately). The screen is a prompt,
not a hard gate.

---

## Step 8: Reactivation flow after payment recovery

After a suspended user updates their payment method in the Stripe portal, Stripe fires
`invoice.paid` or `customer.subscription.updated` with `status = 'active'`. The webhook
handler (built in prompt 01) calls `reactivateSubscription()` which sets `status = 'active'`
and re-enables all workers.

On the UI side: when the user returns from the Stripe portal to `/billing/aiva`, the page
fetches subscription status. If status is now `active`:

1. Clear the `aiva_plan_status` cookie by writing the updated status
2. Show a success flash: "Your subscription is active. Your Aivas have been reactivated."

The user does not need to manually toggle each Aiva. The backend reactivates them all via
`reactivateSubscription()`. Confirm this is the case in the backend code before assuming it.
If `reactivateSubscription()` does not resume workers automatically, add that logic now.

---

## Step 9: New backend routes (add to aiva-api.ts)

```
POST /api/aiva/billing/resolve-downgrade
  Auth: workspace session
  Body: { workspaceId, keepWorkerIds: string[] }
  Action:
    1. Verify keepWorkerIds.length <= pendingDowngradeSlotLimit
    2. Pause all active workers NOT in keepWorkerIds (set status = 'paused')
    3. Set pending_downgrade_conflict = false on aiva_subscriptions
  Response: { resolved: true, pausedWorkerIds: string[], keptWorkerIds: string[] }
```

Also verify that `GET /api/aiva/billing/status` (built in prompt 01) returns:
- `pendingDowngradeConflict: boolean`
- `pendingDowngradeTier: string | null`
- `pendingDowngradeSlotLimit: number | null`

If these fields are missing, add them now. Read the `aiva_subscriptions` row for
`pending_downgrade_conflict`, `pending_downgrade_tier`, and `slotLimitForTier(pending_downgrade_tier)`.

---

## Step 10: Next.js API proxy for resolve-downgrade

Create: `src/app/api/aiva/billing/resolve-downgrade/route.ts`

POST - requires workspace session; proxies to core backend; returns 200 on success or 400 on
validation failure (wrong count, invalid worker IDs).

---

## Done When

- [ ] POST `/api/aiva/workers` returns 402 with `error: 'aiva_slot_limit_reached'` when slot limit is reached
- [ ] Upgrade modal renders when the hire form submit receives a 402 response
- [ ] Upgrade modal shows compact plan cards; current tier is badged; higher tiers have upgrade CTA
- [ ] Upgrade CTA redirects to Stripe Checkout for the selected tier
- [ ] Middleware redirects suspended workspaces from `/aiva/*` to `/billing/aiva?reason=suspended`
- [ ] Middleware redirects trial-expired workspaces from `/aiva/*` to `/billing/aiva?reason=trial_expired`
- [ ] Workspace chat routes (`/chat/*`, `/api/chat/*`) are NOT blocked by the suspension redirect
- [ ] `aiva_plan_status` cookie is cleared on the billing success page after a successful payment
- [ ] Grace period banner renders on `/aiva/*` when `status === 'past_due'`; color changes at 2 days and 0 days
- [ ] Grace period banner is not dismissible
- [ ] Grace period "Update payment method" opens Stripe portal
- [ ] Downgrade conflict screen renders on `/aiva` when `pendingDowngradeConflict = true`
- [ ] Conflict screen lists all active Aivas with checkboxes; confirm CTA is disabled until correct count selected
- [ ] Confirming resolves the conflict via POST `/api/aiva/billing/resolve-downgrade` and pauses non-selected Aivas
- [ ] After successful Stripe payment, subscription page shows "subscription active" flash and does not show suspended UI
- [ ] `reactivateSubscription()` re-enables all paused workers (verify or add this logic)
- [ ] `POST /api/aiva/billing/resolve-downgrade` core endpoint exists and is gated to workspace session
- [ ] Next.js proxy `src/app/api/aiva/billing/resolve-downgrade/route.ts` exists
- [ ] No TypeScript errors
- [ ] No em dashes in any copy or JSX strings
- [ ] No emojis
