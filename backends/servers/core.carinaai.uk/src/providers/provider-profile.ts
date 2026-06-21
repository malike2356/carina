export interface ProviderProfile {
  /** Unique name for this profile */
  name: string;

  /** Provider type */
  provider: string;

  /** API key (from env var or direct) */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  /** Default model for this profile */
  model: string;

  /** Priority: lower = tried first. Default: 0. */
  priority?: number;

  /** Whether this profile is currently active */
  enabled?: boolean;

  /** Failure tracking */
  failureCount?: number;
  lastFailureAt?: number;
  cooldownUntil?: number;
}

export interface FailoverConfig {
  /** Max retries before moving to next profile. Default: 2. */
  maxRetries?: number;

  /** Cooldown in ms after a failure before retrying the same profile. Default: 60000 (1 min). */
  cooldownMs?: number;

  /** If true: after all profiles fail, throw. If false: wait and retry. Default: true. */
  failFast?: boolean;
}

export type ProviderErrorType =
  | 'rate_limit'
  | 'auth'
  | 'server_error'
  | 'network'
  | 'invalid_request'
  | 'unknown';

export interface ProviderError {
  type: ProviderErrorType;
  statusCode?: number;
}
