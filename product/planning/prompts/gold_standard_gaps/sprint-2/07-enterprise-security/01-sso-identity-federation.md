# Prompt 01: SSO and Identity Federation

## Context

Enterprise customers require SSO. Currently Carina's web UI uses session-based auth with
a single admin password. Multi-user enterprise deployments need Google Workspace and
Microsoft Entra ID (formerly Azure AD) SSO via OIDC/SAML.

Use `better-auth` which is already in the dependencies (see `package.json`) and provides
OIDC/OAuth2 adapters.

## What to Build

### 1. better-auth configuration

In `src/api/auth.ts`, configure better-auth with OIDC providers:
```typescript
import { betterAuth } from 'better-auth';
import { oidcProvider } from 'better-auth/plugins';

export const auth = betterAuth({
  database: { type: 'postgresql', url: process.env.DATABASE_URL! },
  secret: process.env.AUTH_SECRET!,
  plugins: [
    oidcProvider({
      issuer: 'https://core.carinaai.uk',
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID,  // restrict to org tenant
    },
  },
  advanced: {
    generateId: () => crypto.randomUUID(),
  },
});
```

### 2. SAML support

Add `@better-auth/saml` adapter for enterprise SAML:
```typescript
import { saml } from '@better-auth/saml';

plugins: [
  saml({
    sso: [
      {
        issuer: process.env.SAML_ISSUER!,
        entryPoint: process.env.SAML_ENTRY_POINT!,
        cert: process.env.SAML_CERT!,
      },
    ],
  }),
],
```

Required env vars for SAML:
- `SAML_ISSUER` - IdP entity ID
- `SAML_ENTRY_POINT` - IdP SSO URL
- `SAML_CERT` - IdP public certificate

### 3. Domain-based org routing

When a user logs in with SSO, their email domain determines their org:
```typescript
async function resolveOrg(email: string): Promise<string | null> {
  const domain = email.split('@')[1];
  const org = await db.query('SELECT id FROM organizations WHERE sso_domain = $1', [domain]);
  return org.rows[0]?.id ?? null;
}
```

The org ID is stored in the session and gates access to tenant-specific data.

### 4. User provisioning (SCIM)

Enterprise IdPs can provision and deprovision users via SCIM 2.0. Create `src/api/scim.ts`:
```
POST   /scim/v2/Users          - create user
GET    /scim/v2/Users/:id      - get user
PATCH  /scim/v2/Users/:id      - update user (deactivate etc.)
DELETE /scim/v2/Users/:id      - deprovision user
GET    /scim/v2/Groups         - list groups
POST   /scim/v2/Groups         - create group (maps to Carina roles)
```

### 5. Login page update

Update `apps/cloud/src/pages/LoginPage.tsx` to show SSO options:
```tsx
// Check if org SSO is configured for the email's domain
const ssoConfig = await checkSsoConfig(email);
if (ssoConfig.google) {
  return <GoogleSsoButton orgId={ssoConfig.orgId} />;
}
if (ssoConfig.microsoft) {
  return <MicrosoftSsoButton orgId={ssoConfig.orgId} />;
}
if (ssoConfig.saml) {
  return <SamlSsoButton orgId={ssoConfig.orgId} />;
}
// Fall through to email/password form
```

### 6. Required env vars

Add to `.env.production.example`:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
SAML_ISSUER=
SAML_ENTRY_POINT=
SAML_CERT=
AUTH_SECRET=   # 32-char random secret for better-auth
```

## Verification Checklist

- [ ] Google SSO: user with Google Workspace account logs in via OAuth flow
- [ ] Microsoft SSO: user from Entra ID tenant authenticates via OIDC
- [ ] SAML: configure Okta as IdP, user logs in via SAML assertion
- [ ] Domain routing: user from `acme.com` is placed in `acme` org automatically
- [ ] SCIM: POST to `/scim/v2/Users` creates user in Carina database
- [ ] Deprovisioned user's session is invalidated within 60 seconds of SCIM DELETE

## Files to Create or Modify

- MODIFY `src/api/auth.ts` - configure better-auth with SSO providers
- CREATE `src/api/scim.ts` - SCIM 2.0 endpoints
- MODIFY `src/server.ts` - mount SCIM routes
- MODIFY `apps/cloud/src/pages/LoginPage.tsx` - add SSO buttons
- MODIFY `.env.example` - add SSO env vars
