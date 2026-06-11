import { getCredentialPoolManager } from './pool-manager.js';
import type { KeyFailureReason } from './types.js';

export function classifyApiError(err: unknown): KeyFailureReason | null {
  if (!err || typeof err !== 'object') return null;
  const status = (err as { status?: number }).status
    ?? (err as { statusCode?: number }).statusCode
    ?? (err as { response?: { status?: number } }).response?.status;
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  const message = String((err as Error).message ?? '').toLowerCase();
  if (message.includes('rate limit') || message.includes('quota') || message.includes('too many requests')) {
    return 'rate_limit';
  }
  if (message.includes('invalid api key') || message.includes('authentication') || message.includes('unauthorized')) {
    return 'auth';
  }
  return null;
}

export async function withCredentialRotation<T>(
  provider: string,
  singleKey: string,
  poolEnv: string | undefined,
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const mgr = getCredentialPoolManager();
  const attempts = Math.max(1, mgr.poolSize(provider, singleKey, poolEnv));
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    const apiKey = mgr.nextKey(provider, singleKey, poolEnv);
    try {
      return await fn(apiKey);
    } catch (err) {
      lastError = err;
      const reason = classifyApiError(err);
      if (!reason) throw err;
      mgr.reportFailure(provider, apiKey, reason);
      if (i + 1 >= attempts) break;
    }
  }

  throw lastError;
}
