# SSO 004: Login discovery and JIT provisioning

**Sprint:** Enterprise auth readiness
**Prompt number:** SSO-004
**Name:** Add domain discovery, SSO sign-in, and workspace provisioning
**Primary agent:** Claude Code
**Estimated hours:** 5-8 h
**Depends on:** SSO-001, SSO-002, and SSO-003

**Status: COMPLETED 2026-06-26**

**What was built:** `/api/auth/sso/resolve`, `/api/auth/sso/authorize`, `/api/auth/sso/callback`; `provisioning.ts` and `session-bridge.ts`; login page SSO discovery and JIT workspace membership.

---

## Context

After providers can be configured, users need a clean login path. A user should be able
to enter a company email address, have Carina resolve the matching workspace SSO provider,
and be redirected through the Better Auth SSO flow. After the IdP callback, Carina should
create or link the user and attach them to the correct workspace.

This prompt must preserve existing login behavior for email/password, Google, app host,
and Aiva host.

Official reference: `https://better-auth.com/docs/plugins/sso`

---

## Files to inspect

- `03-frontends/client-apps/app.carinaai.uk/src/app/login`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth-client.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/workspace.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/sso/workspace-sso.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/audit.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/i18n/locales/en.ts`

---

## Files to create or edit

- `03-frontends/client-apps/app.carinaai.uk/src/app/api/auth/sso/resolve/route.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/sso/provisioning.ts`
- Existing login page and login form components
- Existing auth server and client config

---

## Change steps

1. Add a domain discovery endpoint.

   Suggested route:

   - `POST /api/auth/sso/resolve`

   Request:

   ```json
   { "email": "person@example.com" }
   ```

   Response when enabled provider exists:

   ```json
   {
     "ssoAvailable": true,
     "providerId": "provider-id",
     "domain": "example.com"
   }
   ```

   Response when no provider exists:

   ```json
   { "ssoAvailable": false }
   ```

   Never leak provider secrets or internal workspace data in this response.

2. Add SSO discovery to the login UI.

   The login page should allow a user to enter a work email and continue with SSO when a
   matching enabled provider exists. Keep email/password login available unless the domain
   policy later disables it.

3. Start the Better Auth SSO sign-in flow using the current official client API.

   Use the provider id returned by the discovery endpoint. Preserve `returnTo` or redirect
   intent so users land back in the app or Aiva workspace they started from.

4. Add JIT provisioning.

   On successful SSO callback, Carina should:

   - find the workspace by the verified provider domain
   - create a user if the IdP identity is new
   - link the SSO account to an existing user when Better Auth determines it is safe
   - add the user to the workspace with the provider default role
   - avoid creating a second personal workspace for SSO-only enterprise users unless the
     existing product behavior requires it

5. Add `src/lib/sso/provisioning.ts` for this workspace membership logic.

   Keep the logic small and testable. Reuse `ensureWorkspaceForUser` where appropriate,
   but do not force all enterprise users to become workspace owners.

6. Add audit events.

   Required events:

   - `sso.discovery.matched`
   - `sso.discovery.not_found`
   - `sso.login.succeeded`
   - `sso.login.failed`
   - `sso.user.provisioned`
   - `sso.workspace_member.created`

7. Handle safety checks.

   - Reject public mailbox domains.
   - Require provider to be enabled.
   - Require the returned IdP email domain to match the configured provider domain unless
     a future verified-domain mapping explicitly allows alternatives.
   - Do not allow arbitrary callback redirect targets.

8. Add tests for discovery and provisioning.

---

## Acceptance criteria

- A user with a configured company domain can start SSO from login.
- A user without a configured company domain can still use existing login options.
- SSO callback creates or links the user and attaches them to the correct workspace.
- SSO users are assigned the provider default role.
- Redirect intent is preserved safely across `app.carinaai.uk` and `aiva.carinaai.uk`.
- Public mailbox domains cannot trigger workspace SSO discovery.
- Audit rows are written for discovery, login, and provisioning events.
- `cd 03-frontends/client-apps/app.carinaai.uk && pnpm build` passes.
- Relevant tests pass.

---

## Do not touch

- Do not remove email/password login.
- Do not make SSO mandatory for any domain in this prompt.
- Do not implement SAML in this prompt.
- Do not loosen redirect validation.
- Do not create duplicate workspaces for every SSO member unless an existing invariant
  requires a personal workspace.
