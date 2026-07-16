import { parseRetryAfterMs, type RetryOptions } from './retry.js';

export const CHANNEL_API_RETRY_DEFAULTS = {
  attempts: 3,
  minDelayMs: 400,
  maxDelayMs: 30_000,
  jitter: 0.1,
} as const;

export const CHANNEL_API_RETRY_RE = /429|421|408|timeout|timed out|connect|reset|closed|unavailable|econnreset|enotfound|eai_again/i;

export type HttpRetryError = {
  kind: 'http';
  status?: number;
  message: string;
  retryAfterMs?: number;
};

export function httpStatusShouldRetry(status?: number): boolean {
  if (status == null) return true;
  if (status === 429 || status === 408 || status === 421) return true;
  return status >= 500;
}

export function errorMessageMatchesRetryPattern(message: string): boolean {
  return CHANNEL_API_RETRY_RE.test(message);
}

export function shouldRetryHttpError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'kind' in error && (error as HttpRetryError).kind === 'http') {
    const httpErr = error as HttpRetryError;
    if (httpErr.retryAfterMs != null) return true;
    if (httpStatusShouldRetry(httpErr.status)) return true;
    return errorMessageMatchesRetryPattern(httpErr.message);
  }
  const msg = error instanceof Error ? error.message : String(error);
  return errorMessageMatchesRetryPattern(msg);
}

export function retryAfterFromHttpError(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'kind' in error && (error as HttpRetryError).kind === 'http') {
    return (error as HttpRetryError).retryAfterMs;
  }
  return undefined;
}

export function channelApiRetryPolicy(overrides: Partial<RetryOptions> = {}): RetryOptions {
  return {
    ...CHANNEL_API_RETRY_DEFAULTS,
    shouldRetry: (error, attempt) => {
      if (overrides.shouldRetry && !overrides.shouldRetry(error, attempt)) return false;
      return shouldRetryHttpError(error);
    },
    retryAfterMs: (error) => retryAfterFromHttpError(error),
    ...overrides,
  };
}

export function httpRetryPolicy(overrides: Partial<RetryOptions> = {}): RetryOptions {
  return channelApiRetryPolicy({
    attempts: 2,
    ...overrides,
  });
}

export function httpRetryError(input: {
  status?: number;
  message: string;
  retryAfterHeader?: string | null;
}): HttpRetryError {
  return {
    kind: 'http',
    status: input.status,
    message: input.message,
    retryAfterMs: parseRetryAfterMs(input.retryAfterHeader),
  };
}
