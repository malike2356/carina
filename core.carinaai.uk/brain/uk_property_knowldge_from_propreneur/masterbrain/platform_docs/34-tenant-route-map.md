# Tenant route map (`routes/tenant.php`)

**Updated:** 2026-05-14 (added lead funnel routes, vcal routes, mentoring OS public routes, group event routes)

## Purpose

Authoritative high-level map of **tenant subdomain** HTTP routes for Carina RAG, support, and developers. Always reconcile with `routes/tenant.php` after changes. Global middleware from stancl: `web`, `InitializeTenancyBySubdomain`, `PreventAccessFromCentralDomains` (see `brain/knowledge/10-tenancy.md`).

## Unauthenticated and special

| Area | Middleware | Notes |
|------|------------|--------|
| `GET /trial-expired` | (none listed) | View `tenant.trial-expired` |
| Login, password reset, tenant 2FA challenge | `guest` | Paths under `/login`, `/forgot-password`, `/reset-password/*`, `/two-factor/challenge` |
| Invitation accept | `guest`, `feature:tenant_user_invitations` | `GET/POST /invitations/{token}` |
| Investor portal auth API | `throttle:60,1` | Prefix **`/api/investor-portal`** (`tenant.api.investor-portal.*`): `POST register`, `POST login`, `GET me` (Sanctum). Resolves tenant by host. See **`55-investors-hub-and-investor-portal-api.md`**. |

## Authenticated without `IdentifyTenantMiddleware`

**Billing (reachable when trial flow blocks main app):** `auth` + `feature:stripe_billing_api` + `throttle:60,1`, prefix `/api/billing`:

- `GET plans`, `GET plans/{plan}` - catalogue (read-only).

**Workspace-admin billing:** same prefix, plus `tenant.workspace_admin`, same feature and throttle:

- `subscribe`, `cancel`, `resume`, `PUT plan`, `portal`, `payment-methods`, `invoices`, `invoices/{invoice}`, download.

## Authenticated with `IdentifyTenantMiddleware`

Logout: `POST /logout`.

**Onboarding:** prefix `/onboarding`, names `tenant.onboarding.*` - wizard before main app (not inside `EnsureWorkspaceOnboardingCompleted`).

## After `EnsureWorkspaceOnboardingCompleted`

Dashboard: `GET /`, `GET /dashboard` (`tenant.dashboard`).

**Search:** `GET /search` - `feature:tenant_global_search`, `TenantSearchController`, throttle.

**Appearance:** `feature:tenant_workspace_branding` - `/settings/appearance` GET/PUT; `/api/theme/*` (JSON theme CRUD and CSS for SPA).

**Workspace admin API:** `tenant.workspace_admin`, `feature:tenant_workspace_admin_api`, prefix `/api` - users, invitations, tenant 2FA, Spatie roles (see `brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md`).

**Workspace team (Blade):** `tenant.workspace_admin`, `feature:tenant_workspace_admin_api` - `GET /settings/team` (`tenant.settings.team.index`).

**Integrations:** `tenant.workspace_admin`, `subscription.feature:integrations`, `feature:integrations` - JSON under prefix `/api/integrations` and `/api/webhook/*` (see `brain/knowledge/30-integrations.md`). **Settings hub:** `GET /settings/integrations` (`tenant.settings.integrations.index`), TrueLayer OAuth `GET /settings/integrations/truelayer/authorize` and `GET /settings/integrations/truelayer/callback`.

**Workspace automation (Blade admin):** `tenant.workspace_admin`, `feature:tenant_workspace_admin_api` - prefix **`/settings/automation`** (`tenant.settings.automation.*`). See **`56-workspace-automation.md`**.

**Modules (each uses `feature:{name}` and usually `subscription.feature:{name}`):**

| Prefix | Feature keys | Notes |
|--------|----------------|------|
| `/deals` | `deal_engine` (+ subscription) | `GET /deals/workspace` hub; `GET/POST /deals/sourcing/criteria` CRUD; calculators and import routes; includes `POST /{deal}/carina-narrative` with extra `carina_ai` (+ subscription) |
| `/properties` | `multi_property` (+ subscription) | Full CRUD |
| `/contacts` | `crm` (+ subscription) | Full CRUD (Blade); Alpine toolbox on index |
| `/investors` | `crm` (+ subscription) | Investors hub Blade routes (`tenant.investors.*`); see **`55-investors-hub-and-investor-portal-api.md`** |
| `/api/crm/*` | `crm` (+ subscription) | JSON API: contacts CRUD, interactions, CSV/XLSX import-export and template; investor score `GET/POST .../contacts/{id}/investor-score`, `GET .../contacts/{id}/matched-pipeline-deals`, `GET .../pipeline-deals/{id}/matched-investors` (`routes/tenant_crm_api.php`, names `tenant.api.crm.*`) |
| `/pipelines`, `/api/pipeline/*` | `pipeline` (+ subscription) | Web board; JSON API for stages, deals, analytics |
| `/compliance` | `compliance` (+ subscription) | Full CRUD |
| `/carina` | `carina_ai` (+ subscription) | `GET /open-deal/{dealId}` (`tenant.carina.fromDeal`), `GET /open-property/{propertyId}` (`fromProperty`), `GET /open-contact/{contactId}` (`fromContact`), `GET /open-pipeline/{pipelineId}` (`fromPipeline`), `GET /open-compliance/{complianceId}` (`fromCompliance`); conversations CRUD and messages |
| `/community` | `community_learning` (+ subscription) | Hub `GET /community` (`tenant.community.index`); JSON API under **`/api/community/*`, `/api/groups*`, `/api/courses*`, …** via `routes/tenant-community-learning.php` (see **`54-community-learning-module.md`**) |
| `/mentoring` | `mentoring_os` (+ subscription) | `GET /mentoring` (`tenant.mentoring.index`); see **`58-mentoring-os-tenant-surface.md`** |

## `subscription.feature` middleware

**Class:** `App\Http\Middleware\CheckSubscriptionFeature` (alias `subscription.feature` in `bootstrap/app.php`).

When central feature flag `stripe_billing_api` is **enabled** for the tenant, the tenant must have the given feature on their plan via `FeatureGatingServiceInterface::hasFeature`; otherwise JSON 403 or abort. When `stripe_billing_api` is **disabled**, the middleware passes through (plan gate skipped) so legacy/dev behaviour still works.

## Related

- `brain/knowledge/54-community-learning-module.md` - community and learning JSON API and hub.
- `brain/knowledge/55-investors-hub-and-investor-portal-api.md` - `/investors` hub and investor portal auth.
- `brain/knowledge/56-workspace-automation.md` - `/settings/automation` rules and runs.
- `brain/knowledge/57-v1-migration-and-platform-migration-console.md` - central admin migration tools (not tenant routes).
- `brain/knowledge/58-mentoring-os-tenant-surface.md` - mentoring hub and schema links.
- `brain/knowledge/30-integrations.md` - integrations API, webhooks, settings page.
- `brain/knowledge/13-routes.md` - conventions (note illustrative snippets).
- `brain/knowledge/17-billing-api.md` - billing controllers; central Stripe webhook.
- `brain/knowledge/16-global-search-and-ui-runtime.md` - `IdentifyTenantMiddleware`, search.
- `brain/knowledge/19-tenant-workspace-onboarding-invitations-and-admin-api.md` - onboarding and admin API detail.
