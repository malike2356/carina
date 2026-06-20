export type RetryAttemptInfo = {
  attempt: number;
  error: unknown;
  delayMs: number;
};

export type RetryOptions = {
  attempts?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Fraction of base delay used as symmetric jitter (0.1 = +/-10%). */
  jitter?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  retryAfterMs?: (error: unknown) => number | undefined;
  onRetry?: (info: RetryAttemptInfo) => void;
  sleep?: (ms: number) => Promise<void>;
};

export class RetryError extends Error {
  readonly attempts: number;

  readonly lastError: unknown;

  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/** Parse Retry-After header value (seconds or HTTP-date). */
export function parseRetryAfterMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

export function computeBackoffDelay(
  attempt: number,
  opts: { minDelayMs: number; maxDelayMs: number; jitter: number },
): number {
  const base = Math.min(opts.maxDelayMs, opts.minDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitterRange = base * opts.jitter;
  const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(base + jitterOffset));
}

export async function retryAsync<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  const minDelayMs = options.minDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const jitter = options.jitter ?? 0.1;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !shouldRetry(err, attempt)) {
        break;
      }
      const retryAfter = options.retryAfterMs?.(err);
      const delayMs = retryAfter != null
        ? Math.min(maxDelayMs, Math.max(minDelayMs, retryAfter))
        : computeBackoffDelay(attempt, { minDelayMs, maxDelayMs, jitter });
      options.onRetry?.({ attempt, error: err, delayMs });
      await sleep(delayMs);
    }
  }

  throw new RetryError(`Operation failed after ${attempts} attempt(s)`, attempts, lastError);
}
