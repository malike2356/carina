# Prompt 01: SSO & Identity Federation

**Gap:** 08; Enterprise Security
**Priority:** CRITICAL
**Build Time:** 2 weeks
**Depends On:** gap-01 (Docker)

---

## GOAL

Carina must support enterprise identity providers via SAML 2.0, OpenID Connect, and LDAP. No enterprise deploys a platform without SSO. This is table stakes for any deal above £79/mo.

## SPECIFICATION

### Supported Protocols

| Protocol | Standard | Use Case |
|----------|----------|----------|
| SAML 2.0 | OASIS Standard | Okta, Azure AD, Ping, OneLogin |
| OpenID Connect | OAuth 2.0 extension | Google Workspace, Auth0, Keycloak |
| LDAP/LDAPS | RFC 4511 | Active Directory, OpenLDAP |

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Identity Layer                  │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  SAML    │  │  OIDC    │  │  LDAP        │  │
│  │  Handler │  │  Handler │  │  Handler     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│       ▼              ▼               ▼          │
│  ┌──────────────────────────────────────────┐   │
│  │        Unified Identity Service           │   │
│  │  • User provisioning (JIT)                │   │
│  │  • Role mapping (IdP group → Carina role) │   │
│  │  • Session management                     │   │
│  │  • Token refresh                          │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                           │
│                     ▼                           │
│  ┌──────────────────────────────────────────┐   │
│  │           Carina Auth Service             │   │
│  │  • Local auth (existing)                  │   │
│  │  • SSO auth  (new)                        │   │
│  │  • Fallback chain                         │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### TypeScript Implementation

```typescript
// src/auth/sso/sso-provider.ts

interface SSOProvider {
  name: string;
  type: 'saml' | 'oidc' | 'ldap';
  enabled: boolean;
  config: SAMLConfig | OIDCConfig | LDAPConfig;
}

interface SAMLConfig {
  entryPoint: string; // IdP SSO URL
  issuer: string; // Carina entity ID
  cert: string; // IdP signing certificate
  signatureAlgorithm: 'sha256';
  audience: string;
  nameIdFormat: string; // 'emailAddress' | 'unspecified'
  attributeMapping: {
    email: string; // SAML attribute for email
    firstName: string;
    lastName: string;
    groups: string;
  };
}

interface OIDCConfig {
  clientId: string;
  clientSecret: string; // Encrypted at rest
  issuer: string; // Discovery URL
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
  scopes: string[]; // ['openid', 'profile', 'email']
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
}

interface LDAPConfig {
  url: string; // ldap:// or ldaps://
  bindDN: string;
  bindCredentials: string; // Encrypted at rest
  searchBase: string;
  searchFilter: string; // '(mail={{username}})'
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
  tls: {
    enabled: boolean;
    caCert?: string;
    rejectUnauthorized: boolean;
  };
}

interface JITProvisioning {
  enabled: boolean;
  defaultRole: 'viewer' | 'operator';
  createUserOnFirstLogin: boolean;
  updateUserOnLogin: boolean;
}

// Role mapping function
async function mapIdpRoles(idpGroups: string[], mapping: RoleMapping[]): Promise<CarinaRole> {
  // Iterate through ordered mappings and return the highest matching role
  for (const map of mapping) {
    for (const group of idpGroups) {
      if (map.idpGroup === group) return map.carinaRole;
    }
  }
  return 'viewer'; // default
}
```

### Configuration (Environment)

```bash
# SSRPROVIDER=saml|oidc|ldap
SSO_PROVIDER=saml

# SAML
SAML_ENTRY_POINT=https://myorg.okta.com/app/carina/sso/saml
SAML_ISSUER=https://carinaai.uk
SAML_CERT=/etc/carina/certs/idp-signing.crt
SAML_EMAIL_ATTR=email
SAML_FIRST_NAME_ATTR=firstName
SAML_LAST_NAME_ATTR=lastName
SAML_GROUPS_ATTR=groups

# OIDC
OIDC_CLIENT_ID=carina-prod
OIDC_CLIENT_SECRET=***  # Encrypted
OIDC_ISSUER=https://accounts.google.com

# LDAP
LDAP_URL=ldaps://ad.myorg.com:636
LDAP_BIND_DN=cn=carina-svc,ou=ServiceAccounts,dc=myorg,dc=com
LDAP_SEARCH_BASE=dc=myorg,dc=com

# JIT Provisioning
SSO_JIT_ENABLED=true
SSO_JIT_DEFAULT_ROLE=viewer

# Role Mapping (JSON string or file path)
SSO_ROLE_MAPPING='[{"idpGroup":"carina-admins","carinaRole":"admin"},{"idpGroup":"carina-operators","carinaRole":"operator"},{"idpGroup":"carina-viewers","carinaRole":"viewer"}]'
```

### Login Flow

```
1. User visits https://carinaai.uk/login
2. Enters email → System detects domain is SSO-enabled
3. Redirect to IdP login page
4. User authenticates with IdP (MFA handled by IdP)
5. IdP POSTs SAML assertion / redirects with OIDC code
6. Carina validates signature/code
7. Carina extracts attributes (email, name, groups)
8. Carina maps groups → Carina roles
9. JIT: creates user if first login, updates if subsequent
10. Carina issues session token
11. Redirect to dashboard
```

### Admin UI

```
Settings → Enterprise → SSO
  ┌──────────────────────────────────────────┐
  │ SSO Configuration                        │
  │                                          │
  │ Provider: [SAML ▾]                       │
  │ Status:   ● Connected (Okta)             │
  │                                          │
  │ Entry Point: https://...okta.com/...     │
  │ Issuer:      https://carinaai.uk         │
  │ Certificate: [Upload .crt file]          │
  │                                          │
  │ Attribute Mapping:                       │
  │   Email:      email                      │
  │   First Name: firstName                  │
  │   Last Name:  lastName                   │
  │   Groups:     groups                     │
  │                                          │
  │ JIT Provisioning: [] Enabled            │
  │   Default Role: [viewer ▾]              │
  │                                          │
  │ Role Mapping:                            │
  │   carina-admins     → Admin              │
  │   carina-operators  → Operator           │
  │   carina-viewers    → Viewer             │
  │   [+ Add Mapping]                        │
  │                                          │
  │ [Test Connection]  [Save]                │
  └──────────────────────────────────────────┘
```

### Test Matrix

| Provider | Protocol | Test |
|----------|----------|------|
| Okta | SAML | Full flow + JIT + role mapping |
| Azure AD | SAML | Full flow + group sync |
| Google Workspace | OIDC | Full flow |
| Auth0 | OIDC | Full flow |
| Keycloak | OIDC | Self-hosted test |
| OpenLDAP | LDAP | Bind + search + attribute mapping |
| Active Directory | LDAPS | Bind + search + group enumeration |

### Pitfalls

1. **Certificate rotation**; IdP certs expire. Build auto-fetch from IdP metadata URL.
2. **Clock skew**; SAML assertions have NotBefore/NotOnOrAfter. Keep NTP synced.
3. **Group sync frequency**; Roles change in IdP. Sync on every login or risk stale permissions.
4. **Multiple IdPs**; Some enterprises have multiple. Support multi-IdP federation.
5. **Fallback**; If SSO is down, operators get locked out. Maintain local admin bypass.
6. **Metadata URL**; Prefer auto-configuration via IdP metadata endpoint over manual entry.

### Verification

```bash
# Test SAML metadata endpoint
curl https://carinaai.uk/auth/saml/metadata

# Test OIDC discovery
curl https://carinaai.uk/auth/.well-known/openid-configuration

# Test SSO login (manual browser flow)
# 1. Navigate to https://carinaai.uk/login
# 2. Enter SSO-enabled email
# 3. Verify redirect to IdP
# 4. Authenticate
# 5. Verify redirect back with valid session
```
