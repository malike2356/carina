# SOP 024: Enterprise SSO OIDC Setup
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** app.carinaai.uk SSO module
**Last reviewed:** 2026-06-26

**Prerequisites:** `023-enterprise-sso-overview.md`

---

# Step-by-step: OIDC provider configuration

OIDC is the default choice for Okta, Azure AD, Auth0, and Google Workspace OpenID apps.

---

## Step 1: Create the OIDC app in the IdP

Create an **OpenID Connect / OAuth2 web application** in the customer IdP.

### Required IdP settings

| Setting | Value |
|---------|-------|
| Application type | Web / Regular Web App (not SPA-only unless IdP allows confidential web client) |
| Redirect URI / Sign-in redirect | `https://app.carinaai.uk/api/auth/sso/callback` |
| Scopes | `openid`, `email`, `profile` (or IdP equivalent) |
| Grant type | Authorization code |
| PKCE | Supported (Carina sends S256 code challenge) |

### Copy from the IdP when done

- **Issuer URL** (authority / discovery base; Carina appends `/.well-known/openid-configuration`)
- **Client ID**
- **Client secret**

### Vendor reference

| IdP | Where to create | Issuer URL example |
|-----|-----------------|-------------------|
| **Okta** | Applications → Create App Integration → OIDC → Web | `https://your-org.okta.com` |
| **Azure AD** | App registrations → New registration → Web redirect URI | `https://login.microsoftonline.com/{tenant-id}/v2.0` |
| **Auth0** | Applications → Create → Regular Web Application | `https://your-tenant.auth0.com` |
| **Google Workspace** | Google Cloud Console → APIs & Services → Credentials → OAuth client (internal) | `https://accounts.google.com` |

### Azure AD notes

- Redirect URI type: **Web**
- Under **Token configuration**, ensure `email` is available (often included via `openid` + `profile`).
- Issuer for single-tenant apps is usually `https://login.microsoftonline.com/{tenant-id}/v2.0`.

### Okta notes

- Assign the app to the users or groups who should access Carina.
- Sign-in redirect URI must match exactly (no trailing slash mismatch).

---

## Step 2: Add the provider in Carina

1. Sign in at `https://app.carinaai.uk` as the **workspace owner**.
2. Open **Settings** (left sidebar).
3. Select the **Security** section.
4. Scroll to **Single sign-on**.
5. Click **Add OIDC provider**.
6. Complete the form:

| Field | Example | Notes |
|-------|---------|-------|
| Display name | `Acme Okta` | Internal label for the team |
| Company email domain | `acme.com` | Lowercase, no `@` prefix |
| Issuer URL | `https://your-org.okta.com` | Must be valid HTTPS URL |
| Client ID | (from IdP) | |
| Client secret | (from IdP) | Never shown again after save |
| Default member role | `member` or `admin` | Never `owner` |
| Enable provider | On | Leave off until IdP is ready if you prefer |
| Require SSO for this domain | Off initially | Enable after successful test (see SOP 026) |

7. Click **Create provider**.

The settings panel displays callback URLs for copy-paste into the IdP if needed.

---

## Step 3: Test OIDC login

1. Open a **private/incognito** browser window.
2. Go to `https://app.carinaai.uk/login`.
3. Enter `you@acme.com` (must match the configured domain).
4. Tab out of the email field (or wait for discovery). You should see **Continue with SSO**.
5. Click **Continue with SSO**. Browser redirects to the IdP.
6. Sign in at the IdP.
7. Confirm you land in Carina (`/launcher` or Aiva `/aiva` depending on host).

### Expected outcomes

| Outcome | Meaning |
|---------|---------|
| User created, in workspace | First-time JIT provisioning worked |
| Existing user linked | Email or SSO subject matched an account |
| Redirect to `/login?error=sso_domain` | IdP returned an email outside the configured domain |
| Redirect to `/login?error=sso_expired` | State cookie older than 10 minutes; restart from login |

---

## Step 4: Example walkthrough (Okta, ~5 minutes)

1. Okta Admin → **Applications** → **Create App Integration**.
2. Sign-in method: **OIDC**; Application type: **Web Application**.
3. Sign-in redirect URI: `https://app.carinaai.uk/api/auth/sso/callback`.
4. Save. Copy **Client ID**, **Client secret**, and Okta domain (issuer).
5. Carina → **Settings → Security → Single sign-on → Add OIDC provider**.
6. Domain: `yourcompany.com`; issuer: `https://dev-12345.okta.com`; paste credentials.
7. Enable provider. Save.
8. Log out. Visit `/login`, enter `you@yourcompany.com`, click **Continue with SSO**.

---

## Step 5: Hand off to the customer

Provide the customer:

1. Callback URL: `https://app.carinaai.uk/api/auth/sso/callback`
2. Required scopes: `openid email profile`
3. Instruction to use their **company email** on the Carina login page (not a personal Gmail)

Do **not** send stored client secrets by email after initial setup. Use the IdP's secret rotation flow if compromised.

---

## Related

- SAML alternative: `025-enterprise-sso-saml-setup.md`
- Mandatory SSO and troubleshooting: `026-enterprise-sso-testing-troubleshooting.md`
