# Carina Ops; Exhaustive Feature Extraction: Action Prompts 00-38

Each entry: **file number | file name | feature/functionality requested | what specifically needs to be built** (API endpoints, UI pages, backend modules).

---

## README.md
- **Feature:** Project overview and build-order map for Carina Ops productization.
- **What to build:** Defines the build order across 7 sprints (39 prompts). Establishes naming convention: customer UI in `src/gateway/web/ops/`, customer API in `src/api/carina-ops-routes.ts` mounted at `/api/carina-ops/*`. Private VERLOX back office stays in `ops.carinaai.uk/`. Reference docs and validation commands.

---

## 00 | 00-lock-spec-and-boundaries.md
- **Feature:** Freeze product scope and billing plan IDs before any schema or customer UI work.
- **What to build:**
  - **Backend:** `ops.carinaai.uk/lib/billing-plans.ts`; extend `BillingPlanId` type with `carina_ops_starter` (£49/mo) and `carina_ops_team` (£99/mo). Add plan entries to `ASSIGNABLE_PLANS`.
  - **Backend:** `core.carinaai.uk/src/hosted/plan-features.ts`; new module with `PlanTier` type, `PlanFeatureLimits` interface, `PLAN_FEATURES` map, `normalizePlanId()` function. Feature flags: `opsConsole`, `maxMembers`, `maxByokProviders`, `auditRetentionDays`, `deployments`, `exports`.
  - **Config:** `core.carinaai.uk/.env.example`; add `HOSTED_MODE`, `CARINA_OPERATOR_HOSTS`, `CARINA_OPS_PRODUCT_ENABLED`, `STRIPE_PRICE_CARINA_OPS_STARTER`, `STRIPE_PRICE_CARINA_OPS_TEAM`.
  - **Config:** `core.carinaai.uk/src/config/index.ts`; wire `CARINA_OPS_PRODUCT_ENABLED` boolean.
  - **Backend:** `ops.carinaai.uk/routes/ai-platform.ts`; add internal prototype header comment.
  - **Test:** `core.carinaai.uk/src/hosted/plan-features.test.ts`.

---

## 01 | 01-org-migrations-schema.md
- **Feature:** Add `organizations`, `org_memberships`, and `org_invites` tables plus `org_id` columns on hosted product tables.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/api/hosted-migrations.ts`; new SQL migrations for `organizations` (id, name, slug, owner_user_id, plan, status), `org_memberships` (org_id, user_id, role CHECK: owner/admin/operator/auditor/viewer), `org_invites` (org_id, email, role, token_hash, expires_at). Add `org_id UUID` columns to `subscriptions`, `usage_records`, `tenant_provider_keys`, `invoices`, `ops_audit_log`.
  - **Backend:** `ops.carinaai.uk/lib/hosted-migrations.ts`; mirror migrations for ops panel.
  - **Backend:** `core.carinaai.uk/src/hosted/org-types.ts`; export `OrgRole`, `OrganizationRow`, `OrgMembershipRow` types.
  - **Test:** `core.carinaai.uk/src/api/__tests__/hosted-org-migrations.test.ts`.

---

## 02 | 02-register-creates-org.md
- **Feature:** Every new hosted registration automatically creates an organization and owner membership.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/org-service.ts`; `slugifyOrgName()`, `createOrgForUser()` (insert org + membership + subscription link + default model seed), `getPrimaryOrgForUser()`.
  - **Backend:** `core.carinaai.uk/src/api/hosted-auth.ts`; call `createOrgForUser()` in `registerUser()`. Update `loginUser()` to load primary org and include `orgId` + `role` in JWT payload and session.
  - **Backend:** `core.carinaai.uk/src/api/hosted-web.ts`; set `hostedOrgId` and `hostedOrgRole` in session on login/register.
  - **Types:** `core.carinaai.uk/src/types/web-session.d.ts`; extend `SessionData` with `hostedOrgId`, `hostedOrgRole`.
  - **Test:** `core.carinaai.uk/src/hosted/org-service.test.ts`.

---

## 03 | 03-rbac-module.md
- **Feature:** Single RBAC module mapping org roles to allowed actions for all Carina Ops APIs.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/rbac.ts`; `RbacAction` type (13 actions: org.settings.read/write, org.members.invite/remove, vault.read/write, workbench.run, usage.read, audit.read, billing.read/write, deployments.read, exports.run). `ROLE_PERMISSIONS` map. `canPerform()`, `assertCanPerform()`, `minRoleFor()` helpers. `ForbiddenError` class in `src/hosted/errors.ts`.
  - **Test:** `core.carinaai.uk/src/hosted/rbac.test.ts`.

---

## 04 | 04-org-member-middleware.md
- **Feature:** Express middleware resolving org context from session/JWT and enforcing RBAC on protected routes.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/org-context.ts`; `OrgContext` interface, `getOrgContext()`, `requireOrgContext()`, `orgContext()` typed helper.
  - **Backend:** `core.carinaai.uk/src/gateway/web-auth.ts`; add `requireOrgMember(action)` middleware factory, `requireHostedSession` that auto-populates org.
  - **Types:** `core.carinaai.uk/src/types/web-session.d.ts`; add `hostedOrgId`, `hostedOrgRole`.
  - **Test:** `core.carinaai.uk/src/hosted/org-context.test.ts`.

---

## 05 | 05-org-invites-endpoints.md
- **Feature:** Allow owners/admins to invite users by email and accept invites to join an org with a scoped role.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/org-invites.ts`; `createInvite()`, `acceptInvite()`, `listPendingInvites()`, `revokeInvite()`. Token: 32-byte random, SHA-256 hash, 7-day expiry, single use.
  - **API endpoints:** Under `/app/auth/org/`:
    - `POST /invites` (RBAC: org.members.invite); body `{ email, role }`
    - `GET /invites` (RBAC: org.settings.read)
    - `DELETE /invites/:id` (RBAC: org.members.invite)
    - `POST /invites/accept` (public, logged in); body `{ token }`
  - **Backend:** `core.carinaai.uk/src/api/hosted-web.ts`; add invite routes.
  - **Test:** `core.carinaai.uk/src/api/__tests__/hosted-org-invites.test.ts`.

---

## 06 | 06-tenant-backfill-cli.md
- **Feature:** Backfill `organizations` and `org_memberships` for existing `hosted_users` rows that predate the org model.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/org-backfill.ts`; `listUsersWithoutOrg()`, `backfillOrgForUser()`, `backfillAllOrgs()`.
  - **CLI:** `core.carinaai.uk/src/cli/commands/hosted-cli.ts`; add `pnpm carina hosted backfill-orgs [--dry-run] [--user-id=UUID]` command.
  - **Test:** `core.carinaai.uk/src/hosted/org-backfill.test.ts`.

---

## 07 | 07-rbac-tests.md
- **Feature:** Prove role boundaries on real HTTP endpoints with integration tests.
- **What to build:**
  - **Test:** `core.carinaai.uk/src/api/__tests__/hosted-rbac.test.ts`; 12+ test cases: owner/admin/operator/viewer/auditor on various endpoints (invite, billing.write, workbench.run, vault.write, usage.read). Unauthenticated 401 test. Cross-org 403 test.

---

## 08 | 08-org-context-helper.md
- **Feature:** Centralize org-scoped database access so every product query uses the same `org_id` filter.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/scoped-query.ts`; `orgWhereClause()`, `queryForOrg()`, `rejectMissingOrgId()`, `resolveOrgIdFromUser()`.
  - **Backend:** `core.carinaai.uk/src/hosted/org-context.ts`; export `assertOrgId`.
  - **Test:** `core.carinaai.uk/src/hosted/scoped-query.test.ts`.

---

## 09 | 09-scope-billing-byok-queries.md
- **Feature:** Ensure usage, subscriptions, and vault keys are only readable within the caller's organization.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/api/hosted-billing.ts`; filter usage aggregation and subscription reads by `org_id`.
  - **Backend:** `core.carinaai.uk/src/brain/tenant-provider-keys.ts`; update `listTenantProviders()` to accept `orgId` and query by `org_id`.
  - **Backend:** `ops.carinaai.uk/lib/tenant-byok.ts`; join through org for ops support reads, require explicit `tenantId` query param, log to `ops_audit_log`.
  - **Backend:** `ops.carinaai.uk/routes/tenants.ts`; update queries.

---

## 10 | 10-product-audit-log.md
- **Feature:** Create durable `product_audit_log` for customer-visible events separate from `ops_audit_log`.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/api/hosted-migrations.ts`; `product_audit_log` table (id, org_id, actor_user_id, action, resource_type, resource_id, details JSONB, ip_hash, created_at) with index.
  - **Backend:** `core.carinaai.uk/src/hosted/product-audit.ts`; `writeProductAudit()` (with redaction: strip keys matching `/api[_-]?key|secret|password|token/i`, truncate >500 chars), `listProductAudit()`.
  - **Backend:** `ops.carinaai.uk/lib/hosted-migrations.ts`; mirror migration.
  - **Test:** `core.carinaai.uk/src/hosted/product-audit.test.ts`.

---

## 11 | 11-ops-support-tenant-scoping.md
- **Feature:** Harden `ops.carinaai.uk` tenant support routes so cross-tenant access requires explicit tenant ID and is always audited.
- **What to build:**
  - **Backend:** `ops.carinaai.uk/routes/tenants.ts`; validate UUID `tenantId`, return 404 if not found.
  - **Backend:** `ops.carinaai.uk/lib/tenant-audit.ts`; extend `writeOpsAudit()` with tenantId, orgId, action. Log: `tenant.view`, `tenant.plan_override`, `tenant.byok.view`, `tenant.suspend`, `tenant.impersonate_start`.
  - **UI:** `ops.carinaai.uk/views/tenant-detail.ejs`; never render decrypted keys. Add banner: "Internal support view. Not customer Carina Ops."
  - **Test:** `ops.carinaai.uk/lib/tenant-audit.test.ts`.

---

## 12 | 12-tenant-isolation-tests.md
- **Feature:** Automated tests proving cross-tenant reads and forbidden actions fail across vault, usage, and audit.
- **What to build:**
  - **Test:** `core.carinaai.uk/src/api/__tests__/hosted-isolation.test.ts`; seed Org A + Org B with users, vault keys, usage rows, audit events. Test: cross-org vault, usage, audit reads return empty/403. Cross-org invite blocked. Viewer blocked on workbench. `listProductAudit` count excludes other org rows.
  - **Docs:** Update `core.carinaai.uk/prompts/hosted-saas-multitenancy.md`.

---

## 13 | 13-plan-gates-module.md
- **Feature:** Implement `requireOpsPlan` and feature limit checks for free, Starter, and Team tiers.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/plan-gates.ts`; `getOrgPlan()`, `hasOpsConsole()`, `checkFeature()`, `requireOpsPlan(minPlan)` middleware (returns 402 JSON with `upgrade_required`, `plan`, `upgradeUrl`), `requireFeature()` middleware. Plan ordering: free < starter < team. Trial elevation stubbed.
  - **Test:** `core.carinaai.uk/src/hosted/plan-gates.test.ts`.

---

## 14 | 14-ops-static-shell.md
- **Feature:** Build the Carina Ops customer UI shell on `app.carinaai.uk` using static HTML and shared layout JS.
- **What to build:**
  - **UI pages:** `core.carinaai.uk/src/gateway/web/ops/`:
    - `layout.js`; `requireOpsSession()`, `renderNav()`, `showPlanBadge()`.
    - `ops.css`; minimal styles.
    - `index.html`; overview with plan, usage summary, quick links.
    - `workbench.html`; placeholder.
    - `vault.html`; placeholder.
    - `usage.html`; placeholder.
    - `audit.html`; placeholder.
    - `settings.html`; org name, members list.
    - `billing.html`; plan upgrade CTA.
    - `upgrade.html`; shown to free users.

---

## 15 | 15-carina-ops-api-router.md
- **Feature:** Create `carina-ops-routes.ts` for customer product APIs at `/api/carina-ops/*`, separate from operator `ops-routes.ts`.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/api/carina-ops-routes.ts`; `mountCarinaOpsRoutes(app)` with Express router, `requireHostedSession` + `requireOpsPlan('carina_ops_starter')` middleware.
  - **API endpoints:**
    - `GET /overview` (usage.read); returns `{ org, usage, members, onboarding }`.
    - `GET /health`; public, `{ ok: true, product: 'carina-ops' }`.
  - **Backend:** `core.carinaai.uk/src/gateway/web.ts`; mount router after hosted routes.
  - **Test:** `core.carinaai.uk/src/api/carina-ops-routes.test.ts`.

---

## 16 | 16-ops-routing-upgrade-cta.md
- **Feature:** Wire `/ops/*` static pages in the gateway and link from hosted chat UI with correct plan gating.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/gateway/web.ts`; add routes `/ops` and `/ops/:page` with `requireHostedSession` and `requireOpsPlanGate`. Serve static files from `src/gateway/web/ops/`. Free users get `upgrade.html` for all pages except `/ops/billing`.
  - **Backend:** `core.carinaai.uk/src/gateway/web-auth.ts`; add `opsPageHandler`, `requireOpsPlanGate` middleware.
  - **UI:** `core.carinaai.uk/src/gateway/web/hosted-login.html` or post-login landing; add "Carina Ops" link (shown only for starter/team plans).
  - **UI:** `core.carinaai.uk/src/gateway/web/billing.html`; add Ops link.

---

## 17 | 17-ai-platform-migrations-core.md
- **Feature:** Port org-scoped AI platform tables from `ops.carinaai.uk/lib/ai-platform.ts` into core migrations.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/ai-platform-schema.ts`; extract CREATE TABLE statements from ops prototype, rewrite with `org_id UUID NOT NULL REFERENCES organizations(id)`.
  - **Backend:** `core.carinaai.uk/src/hosted/ai-platform-migrate.ts`; `seedDefaultModelsForOrg()` from ops `seedDefaultModels()`.
  - **Backend:** `core.carinaai.uk/src/api/hosted-migrations.ts`; add tables: `ai_platform_models`, `ai_platform_workbench_runs`, `ai_platform_deployments`, `ai_platform_environments`.
  - **Backend:** `core.carinaai.uk/src/hosted/org-service.ts`; call `seedDefaultModelsForOrg` from `createOrgForUser()`.
  - **Test:** `core.carinaai.uk/src/hosted/ai-platform-migrate.test.ts`.

---

## 18 | 18-ops-models-api.md
- **Feature:** Expose `GET /api/carina-ops/models` returning org-scoped model catalog for workbench.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/ai-platform-models.ts`; `listModelsForOrg(orgId)`.
  - **API endpoint:** `GET /models` (usage.read); returns `{ models: [{ id, provider, model, tier, inputPrice, outputPrice, isDefault, status }] }`.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/workbench.html`; fetch models on load, populate `<select id="model">`.

---

## 19 | 19-ops-vault-api.md
- **Feature:** Customer CRUD for provider keys at `/api/carina-ops/vault` with encryption, RBAC, and audit.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/vault-service.ts`; `listVaultEntries()`, `addVaultEntry()`, `removeVaultEntry()`, `toggleVaultEntry()`. Enforce plan-gates max BYOK providers. Audit: `vault.key_added`, `vault.key_removed`, `vault.key_toggled`.
  - **API endpoints:**
    - `GET /vault` (vault.read)
    - `POST /vault` (vault.write)
    - `DELETE /vault/:provider` (vault.write)
    - `PATCH /vault/:provider` (vault.write; enabled toggle)
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/vault.html`; list cards, add form (provider select, password input), remove button, toggle.
  - **Test:** `core.carinaai.uk/src/hosted/vault-service.test.ts`.

---

## 20 | 20-ops-workbench-api.md
- **Feature:** Let customers run prompts through the workbench and meter usage into `usage_records`.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/workbench-service.ts`; port run logic from ops prototype.
  - **API endpoints:**
    - `POST /workbench/run` (workbench.run); body: `{ prompt, provider, model, title }`. Load org BYOK key, insert run row, call LLM router, update with tokens/cost/response, insert `usage_records`, audit.
    - `GET /workbench/runs?limit=20` (usage.read); history.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/workbench.html`; textarea, model select, Run button, results panel, recent runs list.
  - **Test:** `core.carinaai.uk/src/hosted/workbench-service.test.ts`.

---

## 21 | 21-ops-usage-credits-api.md
- **Feature:** Expose org-level usage charts and credit balance at `/api/carina-ops/usage` and `/api/carina-ops/credits`.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/usage-service.ts`; `getUsageSummary()`, `getUsageByModel()`, `getCreditsStatus()`. CreditsStatus: `{ monthlyLimit, usedThisMonth, remaining, percentUsed, warning }`; warning at 80%.
  - **API endpoints:**
    - `GET /usage?days=30` (usage.read)
    - `GET /credits` (usage.read)
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/usage.html`; simple bar chart or table by day (vanilla JS).

---

## 22 | 22-ops-audit-log-api.md
- **Feature:** Customer-facing audit log viewer at `/api/carina-ops/audit` with retention enforced by plan.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/product-audit.ts`; extend `listProductAuditForPlan()` with retention filter by plan. Cursor-based pagination.
  - **API endpoint:** `GET /audit?limit=50&cursor=` (audit.read); returns `{ events: [{ id, action, actorEmail, resourceType, createdAt, details }], nextCursor }`.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/audit.html`; table with action, actor, time, expandable details.

---

## 23 | 23-ops-deployments-environments-api.md
- **Feature:** Team-plan endpoints for deployment and environment tracking, ported from ops AI platform.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/deployments-service.ts`.
  - **API endpoints** (all require `carina_ops_team` via `requireFeature('deployments')`):
    - `GET /deployments` (deployments.read)
    - `POST /deployments` (org.settings.write); body: `{ name, environmentId, notes }`
    - `GET /environments` (deployments.read)
    - `POST /environments` (org.settings.write); body: `{ name, slug }`
  - **UI:** Nav link on overview (team-only). Simple tables.
  - **Test:** `core.carinaai.uk/src/hosted/deployments-service.test.ts`.

---

## 24 | 24-billing-plan-ids.md
- **Feature:** Align billing plan catalog across core and ops with Carina Ops Starter and Team plans.
- **What to build:**
  - **Backend:** `ops.carinaai.uk/lib/billing-plans.ts`; ensure identical plan IDs.
  - **Backend:** `core.carinaai.uk/src/api/hosted-billing.ts`; add `normalizePlanId()` handling.
  - **Backend:** `core.carinaai.uk/src/billing/subscription-manager.ts`; update plan references.
  - **Backend:** `core.carinaai.uk/src/hosted/plan-features.ts`; update feature definitions.
  - **Migrations:** Update `subscriptions.plan` CHECK constraint.
  - **Tests:** Update `ops.carinaai.uk/lib/billing-plans.test.ts` and `core.carinaai.uk/src/api/__tests__/hosted-billing.test.ts`.

---

## 25 | 25-stripe-checkout-portal-ops.md
- **Feature:** Let customers self-serve upgrade to Carina Ops Starter or Team via Stripe Checkout and Customer Portal.
- **What to build:**
  - **API endpoint:** `POST /app/auth/billing/checkout` (billing.write, owner only); body: `{ plan: 'carina_ops_starter' | 'carina_ops_team' }`. Pass `metadata: { org_id, plan }` to Stripe. Success URL: `/ops/billing?checkout=success`, cancel: `/ops/billing?checkout=cancel`.
  - **Backend:** `core.carinaai.uk/src/billing/stripe-service.ts`; extend checkout endpoint for Ops plans.
  - **Backend:** `core.carinaai.uk/src/api/hosted-web.ts`; add route.
  - **Config:** `core.carinaai.uk/.env.example`; document `STRIPE_PRICE_CARINA_OPS_STARTER`, `STRIPE_PRICE_CARINA_OPS_TEAM`.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/billing.html`; show current plan, upgrade buttons (Starter/Team), Stripe portal link. Audit: `billing.checkout_started`.

---

## 26 | 26-stripe-webhook-plan-sync.md
- **Feature:** Webhook handler updates `subscriptions` and `organizations.plan` when Stripe subscription changes.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/billing/stripe-service.ts`; handle events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
  - **Backend:** `core.carinaai.uk/src/api/hosted-web.ts`; webhook route.
  - **Backend:** `core.carinaai.uk/src/hosted/org-service.ts`; sync from Stripe: map price ID → plan ID, update `subscriptions` row, update `organizations.plan`, on cancel dowgrade to `free`. Idempotency via `stripe_events` table. Audit: `billing.plan_changed`.
  - **Test:** dedicated `hosted-stripe-webhook.test.ts` (or extend `hosted-billing.test.ts`).

---

## 27 | 27-usage-limits-warnings.md
- **Feature:** Enforce monthly token limits and surface warnings in API and UI when approaching caps.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/api/hosted-billing.ts`; add `checkOrgUsageQuota()`. Return 429 with `{ error: "quota_exceeded" }` at 100%.
  - **Backend:** `core.carinaai.uk/src/hosted/workbench-service.ts`; call quota check before run.
  - **Backend:** `core.carinaai.uk/src/hosted/usage-service.ts`; extend `getCreditsStatus()` with warning at 80%.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/usage.html` and `index.html`; yellow warning banner.
  - **Audit:** `usage.quota_warning` once per day per org.

---

## 28 | 28-ops-billing-page-ui.md
- **Feature:** Complete customer billing page showing plan, invoices, and upgrade paths.
- **What to build:**
  - **API endpoint:** `GET /api/carina-ops/billing/summary` (billing.read); returns `{ plan, status, currentPeriodEnd, trialEndsAt, invoices: [...] }`.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/billing.html`; current plan card with features list, upgrade buttons (owner only), invoice table with PDF link, Stripe portal button. Query param `?checkout=success` confirmation toast.

---

## 29 | 29-trial-support.md
- **Feature:** 14-day Team trial for new orgs without immediate payment.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/org-service.ts`; set `trial_ends_at` on `createOrgForUser()` (14 days from now).
  - **Backend:** `core.carinaai.uk/src/hosted/plan-gates.ts`; virtual elevation in `getOrgPlan()`: if `trial_ends_at > now()` and plan is free, return `carina_ops_team`. On expiry, return `free` → ops console 402. Checkout during trial converts to paid without data loss.
  - **API:** `core.carinaai.uk/src/api/carina-ops-routes.ts`; show trial banner info.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/billing.html`; trial banner: "Team trial: X days left."
  - **Audit:** `billing.trial_started`, `billing.trial_expired`.

---

## 30 | 30-onboarding-checklist-api.md
- **Feature:** Track self-serve onboarding progress so the UI can guide new customers to first value.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/onboarding-service.ts`; derive onboarding step completion from existing tables.
  - **API endpoints:**
    - `GET /api/carina-ops/onboarding` (usage.read); returns `{ steps: [{ id, label, done }], completedCount, totalCount, percentComplete }`. Steps: register, org, billing, byok, workbench, usage, invite.
    - `POST /api/carina-ops/onboarding/dismiss`; optional hide wizard.
  - **Test:** `core.carinaai.uk/src/hosted/onboarding-service.test.ts`.

---

## 31 | 31-onboarding-wizard-ui.md
- **Feature:** Guided wizard on first visit to Carina Ops that walks users through onboarding steps.
- **What to build:**
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/onboarding.html`; progress bar, step list with checkmarks, primary CTA per incomplete step, skip link, success state at 100%.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/onboarding.js`; polls `GET /api/carina-ops/onboarding` every 10s.
  - **UI:** `core.carinaai.uk/src/gateway/web/ops/layout.js`; redirect to wizard when `percentComplete < 100` and not dismissed.
  - **Backend:** `core.carinaai.uk/src/gateway/web.ts`; add `/ops/onboarding` route.

---

## 32 | 32-audit-usage-exports.md
- **Feature:** Team-plan CSV exports for audit log and usage data.
- **What to build:**
  - **API endpoints** (require `exports` feature / Team tier):
    - `GET /api/carina-ops/audit/export?format=csv`; CSV columns: `id, action, actor_email, resource_type, resource_id, created_at, details_json`. Stream rows (max 10k).
    - `GET /api/carina-ops/usage/export?format=csv&days=30`; CSV columns: `date, model, tokens_used, cost_estimate`.
  - **Backend:** `core.carinaai.uk/src/api/carina-ops-routes.ts`; add export routes with `Content-Type: text/csv`, `Content-Disposition: attachment`.
  - **Backend:** `core.carinaai.uk/src/hosted/product-audit.ts`, `usage-service.ts`; export query methods.
  - **UI:** `audit.html`, `usage.html`; add Export buttons (Team badge).
  - **Audit:** `exports.audit_downloaded`, `exports.usage_downloaded`.

---

## 33 | 33-email-invite-flow.md
- **Feature:** Send branded invite emails when admins invite org members.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/invite-email.ts`; `sendInviteEmail()` using Resend. Subject: `You are invited to ${orgName} on Carina Ops`. Link: `https://app.carinaai.uk/hosted-register?invite=${token}`.
  - **Backend:** `core.carinaai.uk/src/hosted/org-invites.ts`; call from `createInvite()` when `RESEND_API_KEY` set.
  - **Rate limit:** max 20 invites per org per day.
  - **Audit:** `org.member_invited` with hashed email.
  - **Config:** `.env.example`; document `RESEND_API_KEY`.
  - **Test:** `core.carinaai.uk/src/hosted/invite-email.test.ts`.

---

## 34 | 34-support-impersonation.md
- **Feature:** Allow VERLOX support to start a read-only impersonation session for troubleshooting, fully audited. **Internal only:** `ops.carinaai.uk`.
- **What to build:**
  - **Backend:** `ops.carinaai.uk/lib/support-impersonation.ts`; create short-lived token (15 min) in server session.
  - **API endpoints:**
    - `POST /tenants/:id/impersonate` (ops admin only); writes `tenant.impersonate_start` to `ops_audit_log`.
    - `POST /tenants/impersonation/end`; clears session, writes `tenant.impersonate_end`.
  - **UI:** `ops.carinaai.uk/views/tenant-detail.ejs`; red banner: "IMPERSONATION MODE: read-only view for tenant X. End session."
  - **Backend:** `ops.carinaai.uk/routes/tenants.ts`; block write routes during impersonation.
  - **Test:** `ops.carinaai.uk/lib/support-impersonation.test.ts`.

---

## 35 | 35-secret-redaction-audit.md
- **Feature:** Verify and harden redaction so secrets never appear in audit logs, workbench history, or API responses.
- **What to build:**
  - **Backend:** `core.carinaai.uk/src/hosted/redact.ts`; centralized `redactSecrets(obj)`: deep walk, replace keys matching `/api[_-]?key|secret|password|token|authorization/i`, replace `sk-...` and `carina_...` patterns in string values.
  - **Backend:** Apply `redactSecrets` in `product-audit.ts` (`writeProductAudit`), `workbench-service.ts`, `vault-service.ts`, `carina-ops-routes.ts` (response serializer/error handler).
  - **Test:** `core.carinaai.uk/src/hosted/redact.test.ts`; payloads with `apiKey: "sk-test"`, nested `openai_api_key: "sk-abc"`, prompt containing `sk-leaked`.

---

## 36 | 36-marketing-pricing-page.md
- **Feature:** Update `carinaai.uk` to sell Carina AI (free) and Carina Ops (paid) with clear pricing ladder.
- **What to build:**
  - **UI:** `carinaai.uk/index.html`; hero section (Carina AI, "autonomous agent, free to start", CTA to `app.carinaai.uk/hosted-register`), Carina Ops section (promise: "Bring your own keys, govern your agents"), pricing table (Free / Ops Starter £49/mo / Ops Team £99/mo), Scout footnote.
  - **UI:** `carinaai.uk/style.css`; new pricing section layout.
  - **UI:** `carinaai.uk/app.js`; pricing toggle or CTA tracking if needed.

---

## 37 | 37-docs-getting-started.md
- **Feature:** Add user-facing docs for Carina Ops onboarding, BYOK, audit, and plan comparison.
- **What to build:**
  - **Docs pages:** `docs.carinaai.uk/docs/user/carina-ops/`:
    - `index.md`; overview and product ladder (Carina AI vs Carina Ops vs Scout).
    - `getting-started.md`; numbered steps matching onboarding wizard.
    - `byok.md`; supported providers (OpenAI, Anthropic, DeepSeek), encryption, rotation.
    - `audit-and-exports.md`; logged events, retention by plan, CSV export steps.
    - `plans.md`; feature matrix, 14-day trial.
  - **Sidebar:** `docs.carinaai.uk/sidebars.ts`; add Carina Ops section.

---

## 38 | 38-launch-checklist-runbook.md
- **Feature:** Production launch checklist, beta program guide, and internal support runbook.
- **What to build:**
  - **Docs:** `instructions/strategy/CARINA_OPS_LAUNCH_RUNBOOK.md`; sections: pre-launch technical checklist (tests green, isolation passing, Stripe live price IDs, env flags, TLS), Stripe setup (products, webhook, test checkout flow), support procedures (manual plan override, account suspend, impersonation, billing dispute), beta program (3-5 design partners, tracking metrics, weekly feedback template), rollback (disable ops routes).
  - **Docs:** `core.carinaai.uk/prompts/carina-ops-demo-seed.md`; SQL/CLI steps to create demo org with sample data.
  - **Config:** `core.carinaai.uk/.env.production.example`; document all Carina Ops vars.
  - **Docs:** `instructions/strategy/CARINA_OPS_IMPLEMENTATION_PLAN.md`; mark sprint checkboxes complete.

---

## Summary of All Features by Sprint

| Sprint | Files | Features |
|--------|-------|----------|
| **0** (Lock spec) | 00 | Billing plan IDs, feature flag map, env vars, internal prototype tagging |
| **1** (Org foundations) | 01-07 | Org schema migrations, register-creates-org, RBAC module, org middleware, invite endpoints, tenant backfill CLI, RBAC integration tests |
| **2** (Tenant isolation) | 08-12 | Scoped query helper, billing/BYOK org scoping, product audit log, ops support tenant scoping, tenant isolation test suite |
| **3** (UI shell + routing) | 13-16 | Plan gates module, customer ops static shell (9 HTML pages + layout.js), carina-ops API router, ops routing + upgrade CTA |
| **4** (AI platform) | 17-23 | AI platform migrations in core, models catalog API, BYOK vault API, workbench run API, usage/credits API, audit log API, deployments/environments API |
| **5** (Billing + limits) | 24-29 | Billing plan ID alignment, Stripe checkout + portal, Stripe webhook plan sync, usage limits/warnings, ops billing page UI, trial support |
| **6** (Onboarding + polish) | 30-35 | Onboarding checklist API, onboarding wizard UI, audit/usage CSV exports, email invite flow, support impersonation, secret redaction audit |
| **7** (Launch) | 36-38 | Marketing pricing page, docs (getting started, BYOK, audit, plans), launch checklist runbook, demo seed |

---

**Total: 39 feature-documents (00-38) + 1 README = 40 files analyzed.**

**API endpoints total (across all prompts):** ~25 endpoints under `/api/carina-ops/*` (overview, health, models, vault CRUD, workbench run/history, usage, credits, audit, billing summary, deployments CRUD, environments CRUD, onboarding, export CSV), plus invite endpoints under `/app/auth/org/*`, plus billing checkout under `/app/auth/billing/*`, plus impersonation under internal ops.

**UI pages total:** ~15 static HTML pages under `src/gateway/web/ops/` plus `upgrade.html`, plus pricing page on `carinaai.uk`, plus 5 docs pages under `docs.carinaai.uk/`.

**Backend modules total:** ~30+ new TypeScript modules across `src/hosted/` (org-service, rbac, org-context, scoped-query, product-audit, plan-gates, plan-features, org-invites, org-backfill, vault-service, workbench-service, usage-service, ai-platform-models, ai-platform-schema, ai-platform-migrate, deployments-service, onboarding-service, invite-email, redact) plus modifications to ~15+ existing files.
