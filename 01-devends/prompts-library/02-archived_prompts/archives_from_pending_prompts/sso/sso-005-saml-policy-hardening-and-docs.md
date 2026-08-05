# SSO 005: SAML, policy hardening, and docs

**Sprint:** Enterprise auth readiness
**Prompt number:** SSO-005
**Name:** Add SAML support, enterprise auth policy, and operator docs
**Primary agent:** Claude Code
**Estimated hours:** 6-10 h
**Depends on:** SSO-001, SSO-002, SSO-003, and SSO-004

**Status: COMPLETED 2026-06-26**

**What was built:** SAML authorize/ACS routes; `saml-client.ts`; mandatory SSO policy and owner password fallback on login; customer doc `docs/user/security/enterprise-sso.md`; focused tests in `src/lib/sso/`.

---

## Context

OIDC covers many modern customers, but enterprise buyers often still require SAML. After
OIDC is live and tested, add SAML support through the Better Auth SSO plugin and harden
workspace-level SSO policy.

This prompt also adds the operator and customer-facing docs needed to support real
enterprise setups without guessing.

Official reference: `https://better-auth.com/docs/plugins/sso`

---

## Files to inspect

- `03-frontends/client-apps/app.carinaai.uk/src/lib/auth.ts`
- `03-frontends/client-apps/app.carinaai.uk/src/lib/sso`
- `03-frontends/client-apps/app.carinaai.uk/src/app/api/workspace/sso/providers`
- `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings`
- `03-frontends/client-apps/app.carinaai.uk/src/db/schema.ts`
- `marketing/docs/docs.carinaai.uk/`
- `docs/OPS-USER-MANAGEMENT.md`

---

## Change steps

1. Add SAML provider support to the existing SSO provider API.

   Required SAML fields:

   - display name
   - verified domain
   - entity id
   - SSO URL
   - X.509 certificate or metadata XML
   - default workspace role
   - enabled flag

2. Register SAML providers with Better Auth using the current official plugin API.

   Validate metadata, certificates, issuer, ACS URL, and entity ID according to the
   Better Auth SSO docs and the app's deployment URLs.

3. Extend the settings UI.

   Add a SAML option beside OIDC. Support metadata XML paste or upload if the existing UI
   stack already has a safe upload component. If not, use paste-only metadata input first.

4. Add workspace SSO policy controls.

   Suggested controls:

   - require SSO for configured domains
   - allow email/password fallback for owners
   - allowed domains list
   - default member role
   - disable provider without deleting it

5. Add enforcement for mandatory SSO domains.

   If a workspace marks a domain as SSO-required, users with that domain should be guided
   into SSO instead of password login. Keep a controlled owner fallback path so a bad IdP
   configuration does not permanently lock out the workspace.

6. Add role and group mapping if the SAML or OIDC claims include supported group claims.

   Keep the first version conservative:

   - unknown groups do not grant admin access
   - owner role is never granted automatically from IdP claims
   - admin role requires explicit mapping by an existing owner

7. Harden audit logging.

   Required events:

   - `sso.policy.updated`
   - `sso.provider.tested`
   - `sso.saml.metadata.updated`
   - `sso.login.blocked_by_policy`
   - `sso.role_mapping.applied`

8. Add docs.

   Customer-facing docs should live in `marketing/docs/docs.carinaai.uk/` and cover:

   - OIDC setup
   - SAML setup
   - callback or ACS URLs
   - domain verification expectations
   - owner fallback behavior
   - how to rotate secrets or certificates

   Operator docs should cover:

   - env values
   - debugging callback failures
   - database tables
   - how to disable a broken provider safely
   - audit events to inspect

---

## Acceptance criteria

- Workspace owners can configure OIDC and SAML providers from settings.
- Mandatory SSO can be enabled per verified workspace domain.
- Owner fallback is available and documented.
- Email/password login is blocked for SSO-required domains except for the documented
  fallback path.
- SAML metadata and certificates are validated before saving.
- Provider secrets and certificates are not leaked in API responses or logs.
- Role mapping cannot automatically grant owner access.
- Customer and operator docs are added.
- `cd 03-frontends/client-apps/app.carinaai.uk && pnpm build` passes.
- `cd marketing/docs/docs.carinaai.uk && pnpm build` passes if docs are changed.
- Relevant tests pass.

---

## Do not touch

- Do not remove OIDC support.
- Do not remove owner fallback.
- Do not log raw SAML assertions, certificates, client secrets, or tokens.
- Do not add SCIM in this prompt. Leave SCIM as a future enterprise provisioning prompt.
