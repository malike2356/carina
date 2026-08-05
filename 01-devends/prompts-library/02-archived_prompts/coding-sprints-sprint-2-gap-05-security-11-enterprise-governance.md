# Security 11; Enterprise Governance & Trust Framework

**Source:** NEW (No agent has enterprise governance)
**Effort:** 3 weeks

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## SPECIFICATION

Enterprise-grade governance framework: role-based access control, audit logging, policy engine, trust framework, and SSO integration. This is what banks and governments need to deploy Carina.

### Governance Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GOVERNANCE FRAMEWORK                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   RBAC   │  │  AUDIT   │  │  POLICY  │  │  TRUST   │   │
│  │  Roles   │  │  Trail   │  │  Engine  │  │  Model   │   │
│  │  Perms   │  │ Immutable│  │  Rules   │  │ Scoring  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │      SSO        │                       │
│                   │  SAML/OIDC/LDAP │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 1. Role-Based Access Control

```typescript
// security/governance/rbac.ts

enum Role {
  SUPER_ADMIN = 'super_admin',       // Full access
  ADMIN = 'admin',                   // Workspace admin
  SECURITY_ADMIN = 'security_admin', // Security config only
  OPERATOR = 'operator',             // Day-to-day operations
  DEVELOPER = 'developer',           // Skill/plugin development
  AUDITOR = 'auditor',               // Read-only + audit access
  USER = 'user',                     // Basic chat access
  VIEWER = 'viewer',                 // Read-only
}

interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'execute' | 'admin')[];
  scope: 'global' | 'workspace' | 'session' | 'self';
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    { resource: '*', actions: ['*'], scope: 'global' },
  ],
  [Role.AUDITOR]: [
    { resource: 'audit_logs', actions: ['read'], scope: 'global' },
    { resource: 'forensics', actions: ['read'], scope: 'global' },
    { resource: 'compliance', actions: ['read'], scope: 'global' },
    { resource: 'sessions', actions: ['read'], scope: 'workspace' },
    { resource: 'security_events', actions: ['read'], scope: 'global' },
  ],
  [Role.USER]: [
    { resource: 'chat', actions: ['create', 'read'], scope: 'self' },
    { resource: 'sessions', actions: ['create', 'read', 'update', 'delete'], scope: 'self' },
    { resource: 'skills', actions: ['read', 'execute'], scope: 'workspace' },
    { resource: 'documents', actions: ['create', 'read', 'update', 'delete'], scope: 'self' },
    { resource: 'models', actions: ['read'], scope: 'workspace' },
  ],
  // ... all roles defined
};
```

### 2. Immutable Audit Trail

```typescript
// security/governance/audit-trail.ts

interface AuditEvent {
  id: string;
  timestamp: number;
  actor: {
    userId: string;
    role: Role;
    ip: string;
    sessionId: string;
  };
  action: {
    type: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'login' | 'logout';
    resource: string;
    resourceId: string;
    details: Record<string, unknown>;
  };
  outcome: 'success' | 'failure' | 'blocked';
  reason?: string;
  hash: string; // Immutable; chained
  previousHash: string; // Tamper-evident
}

// All audit events are:
// 1. Immutable; append-only, WORM storage
// 2. Hashed; SHA-256, chained for tamper detection
// 3. Queryable; full-text search, filterable
// 4. Exportable; CSV, JSON, PDF for auditors
// 5. Retention; configurable (default: 7 years for compliance)
```

### 3. Policy Engine

```typescript
// security/governance/policy-engine.ts

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enforcement: 'audit' | 'warn' | 'block';
  scope: 'global' | 'workspace' | 'role';
}

interface PolicyRule {
  condition: PolicyCondition;
  action: PolicyAction;
}

// Example policies:
const DEFAULT_POLICIES: SecurityPolicy[] = [
  {
    id: 'require-mfa-for-admin',
    name: 'Require MFA for Admin Access',
    rules: [{ condition: { role: ['admin', 'super_admin'], mfaEnabled: false }, action: 'block' }],
    enforcement: 'block',
    scope: 'global',
  },
  {
    id: 'block-external-tool-install',
    name: 'Block External Tool Installation Without Review',
    rules: [{ condition: { action: 'install_tool', reviewed: false }, action: 'warn' }],
    enforcement: 'warn',
    scope: 'workspace',
  },
  {
    id: 'session-timeout',
    name: 'Auto-logout After Inactivity',
    rules: [{ condition: { inactivityMs: { gt: 3600000 } }, action: 'logout' }],
    enforcement: 'block',
    scope: 'global',
  },
];
```

### 4. SSO Integration

```
Supported: SAML 2.0, OpenID Connect, LDAP, OAuth 2.0
Providers: Okta, Azure AD / Entra ID, Google Workspace, OneLogin, Auth0, Keycloak, PingIdentity

Features:
- Just-in-time user provisioning
- Attribute-based access control (ABAC)
- SCIM 2.0 for user lifecycle management
- IdP-initiated and SP-initiated flows
- Session management with configurable timeout
- MFA enforcement (TOTP, WebAuthn, hardware keys)
```

### 5. Trust Framework

```typescript
// Extends existing security/trust-state.ts

interface TrustFramework {
  // Agent trust; based on behavior over time
  agentTrust: {
    score: number; // 0-100
    factors: {
      promptCompliance: number; // follows system prompt?
      toolDiscipline: number; // uses tools correctly?
      errorRate: number; // how often errors occur
      sequenceNormality: number; // normal tool sequences?
    };
    history: TrustDataPoint[]; // trust over time
  };
  
  // User trust
  userTrust: {
    score: number;
    factors: {
      authenticationStrength: number;
      sessionHistory: number;
      actionPatterns: number;
    };
  };
  
  // Skill/Plugin trust
  skillTrust: {
    score: number;
    factors: {
      provenanceVerified: boolean;
      scannerPassed: boolean;
      communityRating: number;
      installCount: number;
    };
  };
}
```
