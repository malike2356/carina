# SOP 025: Enterprise SSO SAML Setup
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** app.carinaai.uk SSO module
**Last reviewed:** 2026-06-26

**Prerequisites:** `023-enterprise-sso-overview.md`

---

# Step-by-step: SAML provider configuration

Use SAML when the customer IdP or procurement requires SAML 2.0 instead of OIDC.

---

## Step 1: Create the SAML app in the IdP

Create a **SAML 2.0** application in the customer IdP.

### Required IdP settings

| Setting | IdP label (varies) | Value |
|---------|-------------------|-------|
| ACS / Reply URL | Assertion Consumer Service URL | `https://app.carinaai.uk/api/auth/sso/saml/acs` |
| SP Entity ID | Audience / SP Identifier | `https://app.carinaai.uk` (Carina uses app origin) |
| Name ID format | NameID | Email address (`urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`) |
| Binding | ACS binding | HTTP-POST |

### Collect from the IdP

| Field | Typical IdP label |
|-------|-------------------|
| Entity ID | IdP Entity ID / Issuer |
| SSO URL | Single Sign-On URL / SAML 2.0 endpoint |
| Certificate | X.509 signing certificate (PEM) |

### Attribute mapping (critical)

The IdP must release an **email** the user can sign in with:

- **Preferred:** NameID in email format (`user@company.com`), or
- **Alternative:** SAML attribute such as `email` or `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress`

Carina rejects the login if the returned email domain does not match the **Company email domain** configured in Carina.

### Azure AD SAML notes

1. Enterprise applications → New application → Create your own (non-gallery).
2. Single sign-on → **SAML**.
3. Basic SAML Configuration:
   - Identifier (Entity ID): `https://app.carinaai.uk`
   - Reply URL: `https://app.carinaai.uk/api/auth/sso/saml/acs`
4. User Attributes & Claims: ensure `emailaddress` or NameID maps to user mail.
5. Download **Certificate (Base64)** for the signing cert.
6. Copy **Login URL** (SSO URL) and **Azure AD Identifier** (Entity ID).

### Okta SAML notes

1. Applications → Create App Integration → SAML 2.0.
2. Single sign-on URL: `https://app.carinaai.uk/api/auth/sso/saml/acs`
3. Audience URI: `https://app.carinaai.uk`
4. Name ID format: EmailAddress.
5. Attribute statements: `email` → `user.email` if not using email NameID.
6. Copy IdP metadata: SSO URL, Entity ID, signing certificate.

---

## Step 2: Add the provider in Carina

1. Sign in at `https://app.carinaai.uk` as the **workspace owner**.
2. **Settings → Security → Single sign-on**.
3. Click **Add SAML provider**.
4. Complete the form:

| Field | Example | Notes |
|-------|---------|-------|
| Display name | `Acme Azure SAML` | Internal label |
| Company email domain | `acme.com` | Lowercase, no `@` |
| Entity ID | From IdP metadata | IdP issuer / entity ID |
| SSO URL | `https://login.microsoftonline.com/.../saml2` | IdP sign-on endpoint |
| X.509 certificate | PEM block | Full `-----BEGIN CERTIFICATE-----` ... `-----END CERTIFICATE-----` |
| Default member role | `member` or `admin` | Never `owner` |
| Enable provider | On | |
| Require SSO for this domain | Off initially | Enable after test |

5. Click **Create provider**.

Carina validates certificate shape before save. Bare base64 bodies are wrapped into PEM automatically.

---

## Step 3: Test SAML login

1. Private/incognito window → `https://app.carinaai.uk/login`.
2. Enter `you@acme.com`.
3. Click **Continue with SSO** when discovery appears.
4. Authenticate at the IdP.
5. IdP POSTs SAML response to ACS; Carina sets session and redirects to `/launcher` (or Aiva path).

### Expected outcomes

Same as OIDC (see SOP 024). Common SAML-specific failures:

| Symptom | Likely cause |
|---------|--------------|
| Invalid signature | Wrong or expired IdP signing certificate in Carina |
| Missing email | NameID not email format; attribute mapping missing |
| `sso_domain` | Email in assertion does not match configured domain |

---

## Step 4: Rotate SAML certificate

When the IdP rotates signing certificates:

1. Download the new IdP signing cert.
2. Carina → **Settings → Security → Single sign-on** → **Edit** provider.
3. Paste new certificate (leave other fields unchanged).
4. Save.
5. Test login before removing the old cert from the IdP.

Certificates are encrypted at rest; they are never returned by the API or shown in the UI after save.

---

## Step 5: Hand off to the customer

Provide:

1. ACS URL: `https://app.carinaai.uk/api/auth/sso/saml/acs`
2. SP Entity ID: `https://app.carinaai.uk`
3. Requirement that users sign in with `@company.com` email on the Carina login page

---

## Related

- OIDC alternative: `024-enterprise-sso-oidc-setup.md`
- Testing and troubleshooting: `026-enterprise-sso-testing-troubleshooting.md`
