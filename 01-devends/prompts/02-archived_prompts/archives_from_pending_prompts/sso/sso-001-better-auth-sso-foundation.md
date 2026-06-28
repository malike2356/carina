# SSO 001: Better Auth SSO foundation

**Sprint:** Enterprise auth readiness
**Prompt number:** SSO-001
**Name:** Add the Better Auth SSO plugin and database foundation
**Primary agent:** Claude Code
**Estimated hours:** 3-5 h
**Depends on:** Nothing (standalone foundation)

**Status: COMPLETED 2026-06-26**

**What was built:** Custom OIDC/SAML SSO layer on Better Auth sessions (no separate auth framework); `workspace_sso_providers` schema and migration `0015_workspace_sso.sql`; encrypted secret storage via `VAULT_SECRET`; `.env.example` note.

---

## Context

Carina currently uses Better Auth for the cloud app and Aiva workspace auth in
`03-frontends/client-apps/app.carinaai.uk/src/lib/auth.ts`. The app supports
email/password, password reset, optional Google social login, shared cookies across
`app.carinaai.uk` and `aiva.carinaai.uk`, and workspace creation during user creation.

Enterprise SSO has been discussed but is not implemented. The correct path is to extend
the existing Better Auth stack rather than adding a second auth system. Use the Better
Auth SSO plugin as the foundation, with OIDC as the first supported protocol and SAML
handled in a later prompt.

Official reference: `https://better-auth.com/docs/plugins/sso`

At implementation time, check the current Better Auth SSO docs and package version before
coding. Do not rely on stale examples if the plugin API has changed.

---

## Files to inspect

- `03-frontends/client-apps/app.carinaai.uk/package.json`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth-client.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/db/schema.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/db`
- `03-frontends/client-apps/app.carinaai.uk/.env.example`

---

## Change steps

1. Install the Better Auth SSO plugin dependency required by the current docs.

2. Wire the SSO server plugin into `src/lib/auth.ts` without removing existing
   email/password, Google, session, cross-subdomain cookie, or user provisioning logic.

3. Wire the matching client plugin into `src/lib/auth-client.ts` if the current Better
   Auth SSO docs require a client-side plugin.

4. Add any database tables or migrations required by the plugin.

   Use the repo's existing Drizzle migration flow. If Better Auth provides a generator,
   use it and inspect the generated SQL before committing it.

5. Add app-owned SSO metadata tables only where the plugin does not already provide them.
   The minimum app-owned metadata needed later is:

   - workspace id
   - provider id from Better Auth SSO
   - provider type (`oidc` now, `saml` later)
   - verified domain
   - enabled flag
   - default role for provisioned members
   - created by user id
   - timestamps

6. Add environment placeholders to `.env.example` only for non-secret configuration. Do
   not commit real issuer URLs, client secrets, private keys, certificates, or tenant data.

7. Preserve existing auth behavior:

   - email/password registration still provisions a workspace
   - password reset still uses the existing Core mail path
   - cross-subdomain cookies still work for `app.carinaai.uk` and `aiva.carinaai.uk`
   - Google login remains optional and gated by env values

---

## Acceptance criteria

- `pnpm install` or the package manager update completes cleanly in
  `03-frontends/client-apps/app.carinaai.uk/`.
- The Better Auth SSO plugin is registered server-side.
- The matching client helper is available if required by Better Auth.
- Required database schema or migration files are committed.
- Existing login, registration, logout, session loading, and password reset behavior is
  not removed or bypassed.
- `cd 03-frontends/client-apps/app.carinaai.uk && pnpm build` passes.
- Add or update focused tests if the package already has auth or DB migration tests for
  this area.

---

## Do not touch

- Do not add a second auth framework.
- Do not hard-code any enterprise IdP credentials.
- Do not disable email/password login in this prompt.
- Do not implement the settings UI in this prompt.
- Do not deploy to production from this prompt unless explicitly asked after validation.
