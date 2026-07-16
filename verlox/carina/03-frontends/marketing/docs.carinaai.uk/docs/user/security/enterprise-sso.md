# Enterprise single sign-on (SSO)

Carina Cloud (`app.carinaai.uk`) and Aiva (`admin.hireaiva.co.uk`; marketing at `hireaiva.co.uk`) support workspace-level SSO for company email domains. Workspace owners configure providers in **Settings → Security → Single sign-on**.

## Supported protocols

| Protocol | Status | Notes |
|----------|--------|-------|
| OIDC | Supported | Okta, Azure AD, Google Workspace OIDC, Auth0, and similar |
| SAML 2.0 | Supported | Paste IdP entity ID, SSO URL, and signing certificate |

Public mailbox domains (`gmail.com`, `outlook.com`, etc.) cannot be used as SSO domains.

## OIDC setup

1. In your IdP, create an OIDC application.
2. Set the redirect URI to:

   `https://app.carinaai.uk/api/auth/sso/callback`

3. In Carina, open **Settings → Security → Single sign-on → Add OIDC provider**.
4. Enter display name, company email domain, issuer URL, client ID, and client secret.
5. Choose the default workspace role for provisioned members (`member` or `admin`). Owner is never granted automatically.
6. Enable the provider and test sign-in from `/login` with a user on the configured domain.

## SAML setup

1. In your IdP, create a SAML application.
2. Set the ACS (Assertion Consumer Service) URL to:

   `https://app.carinaai.uk/api/auth/sso/saml/acs`

3. In Carina, add a SAML provider with entity ID, SSO URL, and the IdP X.509 signing certificate (PEM).
4. Map the IdP to release an email attribute or NameID in email format.

## Domain verification

SSO discovery matches the email domain on sign-in. The IdP must return an email whose domain matches the provider domain configured in Carina. Mismatched domains are rejected and logged.

## Mandatory SSO and owner fallback

Workspace owners can enable **Require SSO for this domain**. When enabled:

- Members with that email domain are guided to SSO on login.
- Password sign-in is hidden unless the user selects **Workspace owner? Sign in with password**.

This fallback prevents a misconfigured IdP from locking out the workspace owner.

## JIT provisioning

On first successful SSO sign-in, Carina:

1. Creates or links the user account.
2. Adds the user to the workspace that owns the SSO provider.
3. Assigns the provider default role (never `owner`).

SSO users do not receive a separate personal workspace unless they already had one.

## Rotating secrets and certificates

- **OIDC client secret:** Settings → edit provider → enter a new client secret and save. Secrets are encrypted at rest and never shown after save.
- **SAML certificate:** Edit the provider and paste the new IdP certificate.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `sso_expired` on login | Restart SSO from `/login`; state cookies expire after 10 minutes |
| `sso_domain` | IdP email does not match configured domain |
| `sso_config` | Missing client ID, secret, or issuer (OIDC) or SSO URL / certificate (SAML) |
| Discovery returns false | Provider disabled, wrong domain, or public mailbox domain |

Audit events: `sso.discovery.matched`, `sso.login.succeeded`, `sso.login.failed`, `sso.user.provisioned`, `sso.workspace_member.created`, `sso.login.blocked_by_policy`.

## Environment (operators)

| Variable | Purpose |
|----------|---------|
| `VAULT_SECRET` or `BETTER_AUTH_SECRET` | Encrypts stored OIDC client secrets and SAML certificates |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin for callback URLs |
| `BETTER_AUTH_URL` | Better Auth base URL (production: `https://app.carinaai.uk`) |

Database table: `workspace_sso_providers` (see migration `0015_workspace_sso.sql`).

To disable a broken provider safely: edit the provider in settings and turn off **Enable provider**, or delete it after confirming members have another sign-in path.
