const DEFAULT_TIMEOUT_MS = Number(process.env.CARINA_LLM_REQUEST_TIMEOUT_MS ?? '90000');

export function llmRequestTimeoutMs(): number {
  return Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0
    ? DEFAULT_TIMEOUT_MS
    : 90_000;
}

export function llmRequestSignal(): AbortSignal {
  return AbortSignal.timeout(llmRequestTimeoutMs());
}

export function isAbortLikeError(err: unknown): boolean {
  return err instanceof Error
    && (err.name === 'AbortError'
      || err.name === 'TimeoutError'
      || /aborted|timeout/i.test(err.message));
}
