export type KeyFailureReason = 'rate_limit' | 'auth' | 'other';

export interface KeyFailureRecord {
  count: number;
  until: number;
  reason: KeyFailureReason;
}

export interface ProviderPoolState {
  keys: string[];
  index: number;
  failures: Record<string, KeyFailureRecord>;
}

export interface OAuthTokenRecord {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  obtainedAt: number;
}

export interface CredentialsFile {
  version: 1;
  pools: Record<string, ProviderPoolState>;
  oauth: Record<string, OAuthTokenRecord>;
}

export interface OAuthProviderDefinition {
  name: string;
  displayName: string;
  clientIdEnv: string;
  clientSecretEnv?: string;
  scope: string;
  deviceCodeUrl: string;
  tokenUrl: string;
  audience?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface ToolCredential {
  id: number;
  service: string;
  key_name: string;
  encrypted_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialStatus {
  service: string;
  key_name: string;
  configured: boolean;
  source: 'store' | 'env' | 'none';
  masked_value?: string;
}

export interface ToolCapability {
  tool_name: string;
  description: string;
  required_credentials: string[];
  status: 'ready' | 'unconfigured' | 'partial' | 'error';
  missing_credentials: string[];
  category: string;
}
