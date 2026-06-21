# Workspace API access policy

**Status:** Product policy (documented 2026-05-17)  
**Owner:** VERLOX / Propreneur platform  
**Related:** `config/billing.php` (`api_access`), `brain/prompts/19-mobile-api.md`, prompt **15** (billing)

---

## Decision

Programmatic API access (Sanctum PAT, mobile REST, and future partner/integrator keys) is **included in the workspace subscription** - not sold as a separate “API product” and **not offered on lower plans**.

| Plan (slug) | Sort order | API access |
|-------------|------------|------------|
| **Investor** | 5 | **No** |
| **Operator** | 10 | **Yes** |
| **Academy** | 20 | **Yes** (uses `mentor` module set; above Operator) |

**Rule:** API access from **Operator plan and above** only.

Plans added in future with `sort_order` **≥ 10** (same as Operator) inherit API access unless explicitly excluded in `config/billing.php` → `api_access`.

---

## What “API access” means

Included for qualifying workspaces:

- Mobile app auth and data: `/api/mobile/v1/*`, `/api/v1/mobile/*`, `/api/mobile/v1/pipeline/*`
- Tenant JSON APIs that mirror product features (same entitlements as the web UI per `BillingModule`)
- Rate limits and throttles still apply (abuse protection is not “unlimited”)

**Not** included on Investor:

- Issuing or using Sanctum personal access tokens for mobile
- Calling mobile v1 routes (login may succeed only if enforcement is missing - **must be blocked** when enforcement ships)

**Still gated separately** (plan module set, not “API SKU”):

- Carina, Deal Engine, Accounting, vCal, etc. - `subscription.feature:` middleware on each route group
- High-cost usage (Carina tokens, external data) - future quotas / overage per plan

---

## Commercial positioning

- **Do not** list “Free API” on marketing.
- **Do** list “Mobile app & API” (or “Operator & Academy”) on Operator+ plan comparison.
- **Investor** remains web-first; upgrade path to Operator for mobile and integrations.

Trial workspaces: follow `trial_module_set` (`trial_expanded`) for modules; API access during trial should match **Operator+** behaviour if trial is meant to showcase mobile - confirm in checkout copy. If trial is Investor-equivalent, API off until upgrade.

---

## Technical enforcement (target state)

Config source of truth: `config/billing.php` → `api_access`.

1. Resolve tenant’s active `subscription_plans.slug` (or trial).
2. Allow API if plan `sort_order` ≥ `api_access.minimum_plan_sort_order` (10 = Operator).
3. Return `403` with clear JSON/message: *“API access requires the Operator plan or above. Upgrade in Settings → Subscriptions.”*

Apply to:

- All routes in `routes/tenant/mobile_v1_api.php`
- Legacy group `api/mobile/v1` (token, me) in `routes/tenant.php`
- `routes/tenant/mobile_pipeline_api.php`

**Implementation status:** Policy documented; dedicated middleware / login guard **TBD** - grep `api_access` and `EnsureWorkspaceApiAccess` when implementing.

---

## Public developer API (future)

Third-party integrators (accountants, prop tech) are **out of scope** for this policy. When launched:

- Separate **Integrator** tier or add-on
- Workspace-issued API keys with audit trail
- Same minimum plan rules unless contract says otherwise

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-17 | Initial policy: Operator+ only; Investor excluded |
