export type GovernanceRole =
  | 'super_admin'
  | 'admin'
  | 'security_admin'
  | 'operator'
  | 'developer'
  | 'auditor'
  | 'user'
  | 'viewer';

export type GovernanceAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'login'
  | 'logout'
  | '*';

export type GovernanceScope = 'global' | 'workspace' | 'session' | 'self';

export type GovernancePermission = {
  resource: string;
  actions: GovernanceAction[];
  scope: GovernanceScope;
};

export type AuditOutcome = 'success' | 'failure' | 'blocked';

export type GovernanceAuditEvent = {
  id: string;
  timestamp: number;
  actor: {
    userId: string;
    role: GovernanceRole;
    ip: string;
    sessionId: string;
  };
  action: {
    type: GovernanceAction;
    resource: string;
    resourceId: string;
    details: Record<string, unknown>;
  };
  outcome: AuditOutcome;
  reason?: string;
  hash: string;
  previousHash: string;
};

export type PolicyEnforcement = 'audit' | 'warn' | 'block';

export type PolicyCondition = Record<string, unknown>;

export type PolicyRule = {
  condition: PolicyCondition;
  action: string;
};

export type SecurityPolicy = {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enforcement: PolicyEnforcement;
  scope: 'global' | 'workspace' | 'role';
};

export type PolicyEvaluation = {
  policyId: string;
  matched: boolean;
  enforcement: PolicyEnforcement;
  action: string;
  detail: string;
};

export type TrustDataPoint = {
  at: string;
  score: number;
};

export type TrustFramework = {
  generatedAt: string;
  agentTrust: {
    score: number;
    factors: {
      promptCompliance: number;
      toolDiscipline: number;
      errorRate: number;
      sequenceNormality: number;
    };
    history: TrustDataPoint[];
  };
  userTrust: {
    score: number;
    factors: {
      authenticationStrength: number;
      sessionHistory: number;
      actionPatterns: number;
    };
  };
  skillTrust: {
    score: number;
    factors: {
      provenanceVerified: boolean;
      scannerPassed: boolean;
      communityRating: number;
      installCount: number;
    };
  };
};

export type GovernanceStatus = {
  generatedAt: string;
  rbacRoles: number;
  auditEvents: number;
  auditChainValid: boolean;
  activePolicies: number;
  ssoProvidersConfigured: number;
  trust: TrustFramework;
};

export type AuditSearchOptions = {
  userId?: string;
  resource?: string;
  outcome?: AuditOutcome;
  limit?: number;
};
