# SSO 002: Workspace SSO provider API

**Sprint:** Enterprise auth readiness
**Prompt number:** SSO-002
**Name:** Add workspace-owned SSO provider management APIs
**Primary agent:** Claude Code
**Estimated hours:** 4-6 h
**Depends on:** SSO-001

**Status: COMPLETED 2026-06-26**

**What was built:** `src/lib/sso/workspace-sso.ts`; CRUD routes under `/api/workspace/sso/providers`; owner-only authorization; audit events; public domain validation.

---

## Context

Once the Better Auth SSO plugin is available, Carina needs an app-level management layer
that ties SSO providers to workspaces and verified email domains. Better Auth should own
the low-level auth provider details. The Carina app should own workspace policy,
authorization, audit logging, and safe CRUD routes.

The first supported provider type is OIDC. SAML is planned in SSO-005.

Official reference: `https://better-auth.com/docs/plugins/sso`

---

## Files to inspect

- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/db/schema.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/workspace.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/audit.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/app/api`
- `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings`

---

## Files to create or edit

- `03-frontends/client-apps/app.carinaai.uk/src/lib/sso/workspace-sso.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/workspace/sso/providers/route.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/workspace/sso/providers/[id]/route.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/db/schema.ts`
- Drizzle migration files as needed

---

## Change steps

1. Create `src/lib/sso/workspace-sso.ts` for workspace SSO policy helpers.

   It should expose focused helpers for:

   - listing providers for the current workspace
   - creating an OIDC provider
   - updating enabled state and display metadata
   - deleting or disabling a provider
   - resolving a provider by verified domain

2. Add an app-owned table if SSO-001 did not already add one. Suggested shape:

   - `id`
   - `workspace_id`
   - `better_auth_provider_id`
   - `provider_type`
   - `display_name`
   - `domain`
   - `issuer`
   - `default_role`
   - `enabled`
   - `created_by_user_id`
   - `created_at`
   - `updated_at`

3. Add route handlers for provider CRUD.

   Required routes:

   - `GET /api/workspace/sso/providers`
   - `POST /api/workspace/sso/providers`
   - `PATCH /api/workspace/sso/providers/:id`
   - `DELETE /api/workspace/sso/providers/:id`

4. Protect every route with the existing session and workspace authorization model.

   Only workspace owners or admins should be able to manage SSO providers. If the app
   currently has only owner semantics, use owner-only and leave a short TODO for admin
   role support where the role model is expanded.

5. Validate all inputs.

   Minimum validation:

   - domain must be normalized to lowercase
   - domain must not be a public email provider domain
   - provider type must be `oidc`
   - issuer must be a valid URL
   - client id must be present
   - client secret must never be returned by APIs

6. Register the provider with Better Auth using the current official plugin API.

   Store secrets only in the Better Auth provider config or an approved encrypted secret
   store. Do not duplicate client secrets into app metadata tables.

7. Add audit log entries through `src/lib/audit.ts`.

   Required events:

   - `sso.provider.created`
   - `sso.provider.updated`
   - `sso.provider.disabled`
   - `sso.provider.deleted`

8. Add tests around helper validation and route authorization where the app test setup
   supports route handlers.

---

## Acceptance criteria

- Workspace owners can create, list, update, disable, and delete OIDC provider metadata
  through API routes.
- Non-owners cannot manage workspace SSO providers.
- Provider client secrets are never returned by any API response.
- Public mailbox domains such as `gmail.com`, `outlook.com`, and `yahoo.com` cannot be
  configured as workspace SSO domains.
- Audit rows are written for create, update, disable, and delete actions.
- `cd 03-frontends/client-apps/app.carinaai.uk && pnpm build` passes.
- Relevant focused tests pass.

---

## Do not touch

- Do not build the settings UI in this prompt.
- Do not implement SAML in this prompt.
- Do not disable password login for any domain in this prompt.
- Do not expose raw Better Auth provider secrets in API responses.
