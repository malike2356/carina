export type SecretType = 'api_key' | 'oauth_token' | 'jwt' | 'session_token' | 'encryption_key';

export type SecretRotationPolicy = {
  provider: string;
  secretType: SecretType;
  envKey?: string;
  maxAgeMs: number;
  rotationWindowMs: number;
  autoRotate: boolean;
  notifyBeforeMs: number;
};

export type SecretRegistryEntry = {
  provider: string;
  secretType: SecretType;
  envKey?: string;
  credentialId: string;
  createdAt: number;
  lastRotatedAt: number;
  expiresAt: number;
  active: boolean;
};

export type RotationAuditEntry = {
  at: string;
  action: 'secret_rotated' | 'secret_revoked' | 'rotation_scheduled' | 'rotation_failed';
  provider: string;
  oldCredentialId?: string;
  newCredentialId?: string;
  detail?: string;
};

export type SecretStatusRow = {
  provider: string;
  secretType: SecretType;
  envKey?: string;
  ageMs: number;
  expiresInMs: number;
  stale: boolean;
  notifyDue: boolean;
  poolSize: number;
  activeCredentialId: string;
  lastRotatedAt: string;
};

export type SecretsStatusReport = {
  generatedAt: string;
  rows: SecretStatusRow[];
};

export type StaleSecretFinding = {
  provider: string;
  envKey?: string;
  severity: 'warn' | 'fail';
  ageMs: number;
  maxAgeMs: number;
  detail: string;
};

export type SecretsRotationAuditReport = {
  generatedAt: string;
  findings: StaleSecretFinding[];
  summary: { ok: number; warn: number; fail: number };
};

export type RotationResult = {
  provider: string;
  rotated: boolean;
  oldCredentialId?: string;
  newCredentialId?: string;
  message: string;
};
