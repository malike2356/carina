# Carina Ops Sprint 5.5: Ops billing page UI

## Goal

Complete customer billing page showing plan, invoices, and upgrade paths.

## Context

- `src/gateway/web/ops/billing.html` stub from prompt 14
- Invoice data in `invoices` table
- Checkout from prompt 25

## Dependencies

- `14-ops-static-shell.md`
- `25-stripe-checkout-portal-ops.md`
- `26-stripe-webhook-plan-sync.md`

## Files to modify

- `core.carinaai.uk/src/gateway/web/ops/billing.html`
- `core.carinaai.uk/src/api/carina-ops-routes.ts`

## Step-by-step

1. Add API `GET /api/carina-ops/billing/summary`:

```json
{
  "plan": "carina_ops_starter",
  "status": "active",
  "currentPeriodEnd": "...",
  "trialEndsAt": null,
  "invoices": [{ "id", "amount", "status", "pdfUrl", "createdAt" }]
}
```

2. RBAC: `billing.read` for all members; upgrade buttons only for owner.

3. UI sections:

- Current plan card with features list
- Upgrade buttons (owner only)
- Invoice table with PDF link
- Manage payment method via Stripe portal button

4. Query param `?checkout=success` shows confirmation toast.

5. Match styling with `src/gateway/web/billing.html`.

## Expected behavior

- Starter customer sees active plan and invoice history
- Member with role `admin` sees invoices but not upgrade buttons

## Test

Manual E2E with Stripe test mode after webhook prompt complete.

API test: billing summary scoped to org.
