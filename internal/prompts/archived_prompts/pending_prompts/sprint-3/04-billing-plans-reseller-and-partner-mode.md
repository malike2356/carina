# Prompt 04 - Billing, Plans, Reseller, and Partner Mode

**Status: COMPLETED 2026-06-22**

**What was built:**
- `billing/white-label-plans.ts`: Starter, Agency, Enterprise commercial tiers with workspace/billing mappings
- `hosted/partner-service.ts` and `partner-billing.ts`: partner accounts, client org provisioning, per-workspace usage rollups
- Partner PG columns: `commercial_tier`, `owner_org_id`, `stripe_customer_id`, `max_client_orgs`
- Ops API: `/api/carina-ops/partner/account`, `/partner/summary`, `/partner/clients` (GET/POST)
- Branded billing UI via `billing-presentment.ts`, extended `/api/billing/summary`, updated `BillingClient` and billing page
- Tests for commercial tiers, partner usage boundaries, and branded plan rendering
- Pricing docs updated with white-label partner packaging reference

## Objective

Turn billing into a white-label commercial layer that supports resellers, partner accounts, usage based packaging, and separate customer workspaces.

---

## Context

**Working areas:**

- `backends/servers/core.carinaai.uk/src/billing/`
- `backends/servers/core.carinaai.uk/src/hosted/`
- `backends/servers/core.carinaai.uk/src/enterprise/`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/billing/`
- `frontends/client-apps/app.carinaai.uk/src/app/billing/checkout/route.ts`
- `frontends/marketing/docs.carinaai.uk/docs/user/pricing.md`
- `frontends/marketing/carinaai.uk/`

The product already has plans, usage, and billing routes. Extend them into a reseller friendly structure instead of rebuilding billing from scratch.

---

## Required Work

1. Define white-label plan tiers that cover starter, agency, and enterprise use.
2. Add reseller ownership or partner account records where they belong in the data model.
3. Support per-workspace billing summaries and usage reporting under a customer brand.
4. Make plan names and billing copy customer facing where needed, but keep platform accounting internal.
5. Add billing surfaces for partner management, client workspace creation, and usage allocation.
6. Keep existing Stripe or payment integration paths working.
7. Add tests for plan lookup, usage rendering, and reseller ownership boundaries.

---

## Key Files to Update

- `backends/servers/core.carinaai.uk/src/billing/plans.ts`
- `backends/servers/core.carinaai.uk/src/hosted/plan-gates.ts`
- `backends/servers/core.carinaai.uk/src/enterprise/kernel-support.ts`
- `backends/servers/core.carinaai.uk/src/enterprise/security/`
- `frontends/client-apps/app.carinaai.uk/src/components/billing/BillingWindowContent.tsx`
- `frontends/client-apps/app.carinaai.uk/src/components/billing/BillingClient.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/billing/page.tsx`
- `frontends/client-apps/app.carinaai.uk/src/app/api/billing/summary/route.ts`

---

## Constraints

- Do not make the billing system depend on one hardcoded brand.
- Do not mix partner accounting with customer workspace billing rows.
- Do not break current hosted billing or usage warning logic.
- Keep the customer promise understandable, not a nested plan maze.

---

## Done When

- plan tiers support white-label and partner use cases
- usage can be reported per workspace and per partner account
- billing UI can render customer branded labels
- Stripe or equivalent payment flow still works
- tests cover billing boundaries and plan selection

