# SOP 023: Enterprise SSO Overview
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** app.carinaai.uk SSO module (SSO-001 through SSO-005, deployed 2026-06-26)
**Last reviewed:** 2026-06-26

---

# Enterprise single sign-on (SSO) overview

Carina Cloud (`app.carinaai.uk`) and Aiva (`admin.hireaiva.co.uk`; marketing at `hireaiva.co.uk`) support **workspace-level SSO** for company email domains. Workspace owners configure providers in **Settings → Security → Single sign-on**.

Customer-facing copy also lives at `03-frontends/marketing/docs.carinaai.uk/docs/user/security/enterprise-sso.md`.

**Related SOPs:** `024-enterprise-sso-oidc-setup.md`, `025-enterprise-sso-saml-setup.md`, `026-enterprise-sso-testing-troubleshooting.md`, `004-user-management-and-access.md`, `002-deployment-guide.md`.

---

## 1. What is implemented

| Layer | Location |
|-------|----------|
| Provider storage | PostgreSQL table `workspace_sso_providers` (migration `0015_workspace_sso.sql`) |
| Provider CRUD API | `/api/workspace/sso/providers` (owner-only) |
| Login discovery | `POST /api/auth/sso/resolve` |
| OIDC flow | `/api/auth/sso/authorize` → IdP → `/api/auth/sso/callback` |
| SAML flow | `/api/auth/sso/saml/authorize` → IdP → `/api/auth/sso/saml/acs` |
| Settings UI | `Settings → Security → Single sign-on` |
| Sessions | Better Auth signed cookies via `session-bridge.ts` (not a second auth system) |

Secrets (OIDC client secret, SAML certificate) are encrypted at rest using `VAULT_SECRET` or `BETTER_AUTH_SECRET`.

---

## 2. Prerequisites

Before configuring SSO for a customer:

1. **Workspace owner** access on the target workspace.
2. A **real company domain** the customer controls (e.g. `acme.com`).
   - Public mailbox domains are blocked: `gmail.com`, `outlook.com`, `yahoo.com`, etc.
3. **IdP admin access** (Okta, Azure AD, Google Workspace, Auth0, etc.).
4. Production env on VPS:
   - `VAULT_SECRET` or `BETTER_AUTH_SECRET` set in `app.carinaai.uk` `.env`
   - `NEXT_PUBLIC_APP_URL=https://app.carinaai.uk`
   - Migration `0015_workspace_sso.sql` applied (see deploy script)

---

## 3. OIDC vs SAML

| Use OIDC if... | Use SAML if... |
|----------------|----------------|
| IdP offers OpenID Connect / OAuth2 apps | Enterprise buyer requires SAML 2.0 |
| You have issuer URL, client ID, client secret | You have entity ID, SSO URL, X.509 cert |

Most modern IdPs support OIDC first. SAML remains common for legacy enterprise procurement.

---

## 4. Canonical callback URLs

Copy these into the customer IdP. They always use the **app** origin (same for Aiva users).

| Protocol | URL |
|----------|-----|
| OIDC redirect URI | `https://app.carinaai.uk/api/auth/sso/callback` |
| SAML ACS URL | `https://app.carinaai.uk/api/auth/sso/saml/acs` |

Local dev (port 4100):

| Protocol | URL |
|----------|-----|
| OIDC | `http://localhost:4100/api/auth/sso/callback` |
| SAML ACS | `http://localhost:4100/api/auth/sso/saml/acs` |

---

## 5. What happens on first SSO login (JIT provisioning)

1. Carina resolves the email domain to an enabled provider.
2. User authenticates at the IdP.
3. Carina verifies the returned email domain matches the provider domain.
4. Carina creates or links the user in Better Auth.
5. Carina adds the user to the **workspace that owns the provider** with the configured default role (`member` or `admin`).
6. **Owner** is never granted automatically from IdP claims.

SSO-only users do not get a separate personal workspace unless they already had one.

---

## 6. Quick operator checklist

```
IdP side                          Carina side
---------                         -----------
[ ] Redirect/ACS URL set          [ ] Owner signed in
[ ] Email attribute mapped        [ ] Settings → Security → SSO
[ ] Client ID + secret (OIDC)     [ ] Domain = company.com (not gmail.com)
    OR Entity ID + URL + cert     [ ] Provider enabled
      (SAML)                      [ ] Test from /login with @company.com email
```

---

## 7. Next steps

- **OIDC setup:** `024-enterprise-sso-oidc-setup.md`
- **SAML setup:** `025-enterprise-sso-saml-setup.md`
- **Testing, policy, troubleshooting:** `026-enterprise-sso-testing-troubleshooting.md`
