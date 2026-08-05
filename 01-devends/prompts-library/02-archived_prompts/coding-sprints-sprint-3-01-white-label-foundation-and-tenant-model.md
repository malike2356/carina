# Prompt 01 - White-Label Foundation and Tenant Model

**Status: COMPLETED 2026-06-22**

**What was built:**
- `backends/servers/core.carinaai.uk/src/product/brand.ts` with `BrandConfig`, `resolveBrand()`, and precedence (platform > reseller > workspace > user)
- `backends/servers/core.carinaai.uk/src/product/brand.test.ts` covering defaults, overrides, and fallbacks
- `backends/servers/core.carinaai.uk/src/hosted/partner-brand.ts` types for partner accounts and custom domains
- Hosted PG migrations: `partner_accounts`, `custom_domains`, `organizations.partner_id`, `organizations.brand`
- `tenant-workspace-config.ts` optional `brand` field for self-hosted overrides
- App migration `0009_white_label_brand.sql` (`workspace_settings.brand`, `workspaces.core_org_id`)
- `frontends/client-apps/app.carinaai.uk/src/lib/brand.ts` and tests
- Workspace settings API GET/PATCH extended with `brand` and `resolvedBrand`

## Objective

Define the white-label platform contract in the existing codebase. This prompt lays the data model, config shape, and platform boundaries that every later prompt depends on.

The output should let Carina represent:

- platform brand
- reseller brand
- workspace brand
- tenant level settings
- domain binding
- sender identity
- support identity
- partner ownership

Do not just add UI fields. Build the underlying model first.

---

## Context

**Working areas:**

- `backends/servers/core.carinaai.uk/src/hosted/`
- `backends/servers/core.carinaai.uk/src/enterprise/`
- `backends/servers/core.carinaai.uk/src/billing/`
- `frontends/client-apps/app.carinaai.uk/src/db/`
- `frontends/client-apps/app.carinaai.uk/src/app/api/workspace/settings/`

**Existing signals already in the repo:**

- workspace settings already store theme and appearance
- hosted mode already exists
- tenant provider keys already exist
- billing plans already exist
- the app shell already reads workspace settings
- the product already distinguishes hosted versus private surfaces

---

## Required Work

1. Design a white-label config model that can represent platform defaults, reseller overrides, and workspace overrides.
2. Add or extend the workspace settings schema to include brand fields such as product name, short name, logo, favicon, color tokens, support contact, sender name, sender email, and public site title.
3. Add hosted-level data structures for reseller or partner ownership, workspace brand ownership, and tenant display naming.
4. Define a clear precedence order for brand values. Platform default first, reseller second, workspace third, user preference last.
5. Add a server-side helper that resolves the active brand for a request or workspace.
6. Add tests for the precedence order and null fallback behavior.

---

## Key Files to Inspect or Extend

- `frontends/client-apps/app.carinaai.uk/src/app/api/workspace/settings/route.ts`
- `frontends/client-apps/app.carinaai.uk/src/lib/appearance.ts`
- `frontends/client-apps/app.carinaai.uk/src/lib/themes.ts`
- `backends/servers/core.carinaai.uk/src/gateway/hosted-domain.ts`
- `backends/servers/core.carinaai.uk/src/hosted/tenant-workspace-config.ts`
- `backends/servers/core.carinaai.uk/src/hosted/workbench-service.ts`
- `backends/servers/core.carinaai.uk/src/brain/tenant-provider-keys.ts`
- `backends/servers/core.carinaai.uk/src/billing/plans.ts`

---

## Constraints

- Keep Carina as the internal product name unless the customer-facing brand layer overrides it.
- Do not collapse tenant identity and workspace identity into one field if the code currently distinguishes them.
- Do not break hosted mode or current workspace settings payloads.
- Keep migrations additive and reversible where practical.
- Keep the model compatible with self-hosted installs that do not use reseller features.

---

## Done When

- workspace and reseller brand fields exist in the schema or config layer
- a resolved brand object can be built for platform, reseller, and workspace contexts
- the active brand precedence is documented in code
- tests cover default, override, and fallback cases
- nothing in the public API crashes for tenants without new brand data

