# SSO 003: Settings UI for SSO provider management

**Sprint:** Enterprise auth readiness
**Prompt number:** SSO-003
**Name:** Add the workspace settings UI for OIDC SSO setup
**Primary agent:** Cursor
**Estimated hours:** 4-6 h
**Depends on:** SSO-001 and SSO-002

**Status: COMPLETED 2026-06-26**

**What was built:** `src/components/settings/SsoSettings.tsx` in Settings Security section; OIDC and SAML create/edit flows; callback URL display; owner-only controls.

---

## Context

Workspace owners need a clear UI to configure SSO without touching code or database rows.
The UI should live inside the existing workspace settings area and call the provider APIs
from SSO-002.

This prompt only covers OIDC provider management. SAML is handled later in SSO-005.

Official reference: `https://better-auth.com/docs/plugins/sso`

---

## Files to inspect

- `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings`
- `03-frontends/client-apps/app.carinaai.uk/src/components`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth-client.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/i18n/locales/en.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/workspace/sso/providers`

---

## Change steps

1. Add an SSO management surface to the existing settings area.

   Prefer the current settings section pattern. If settings already uses query-string
   sections, add SSO under the security section. If it uses routes, create a small
   security or SSO sub-route that matches the local pattern.

2. Add a provider list.

   Each provider row should show:

   - display name
   - provider type
   - verified domain
   - issuer
   - enabled status
   - created date
   - management actions

3. Add a create provider form for OIDC.

   Required fields:

   - display name
   - company email domain
   - issuer or discovery URL
   - client id
   - client secret
   - default workspace role
   - enabled toggle

4. Show callback and redirect URLs that the customer must copy into their IdP.

   Include values for both relevant hosts when needed:

   - `https://app.carinaai.uk`
   - `https://aiva.carinaai.uk`

   Generate these URLs from runtime config or Better Auth helpers where available. Do not
   hard-code route paths if the plugin exposes canonical callback paths.

5. Add edit and disable flows.

   Owners should be able to:

   - rename a provider
   - enable or disable a provider
   - rotate client secret
   - delete a provider after a confirmation dialog

6. Add loading, empty, error, and saved states.

   The empty state should be direct and operational. Do not add marketing copy.

7. Keep UI copy enterprise-focused.

   Suggested labels:

   - `Single sign-on`
   - `OIDC provider`
   - `Company email domain`
   - `Issuer URL`
   - `Client ID`
   - `Client secret`
   - `Enable provider`
   - `Default member role`

8. Add a disabled SAML option only if it helps the design.

   If shown, label it `SAML` with a concise disabled state such as `Planned`. Do not
   build a fake SAML flow in this prompt.

---

## Acceptance criteria

- Workspace owners can manage OIDC SSO providers from settings.
- Non-owner users do not see provider management controls.
- The UI never displays a stored client secret after saving.
- The create and edit forms handle API validation errors clearly.
- The provider list reflects enabled, disabled, and empty states.
- Callback or redirect URLs are visible and accurate for the current environment.
- `cd 03-frontends/client-apps/app.carinaai.uk && pnpm build` passes.
- If the app has component or route tests for settings, add focused coverage for the SSO
  settings surface.

---

## Do not touch

- Do not implement the login discovery flow in this prompt.
- Do not implement SAML provider creation in this prompt.
- Do not change pricing, billing, or onboarding flows.
- Do not expose provider client secrets in rendered HTML after save.
