export type ErrorClass =
  | 'provider'
  | 'rate_limit'
  | 'budget'
  | 'security'
  | 'timeout'
  | 'validation'
  | 'cancelled'
  | 'unknown';

export type ClassifiedError = {
  class: ErrorClass;
  message: string;
  retryable: boolean;
  provider?: string;
};

const RATE_LIMIT = /rate.?limit|429|too many requests/i;
const TIMEOUT = /timeout|timed out|ETIMEDOUT|abort/i;
const BUDGET = /budget|credit|quota|exhausted|billing/i;
const SECURITY = /blocked|denied|injection|suspended|unauthorized|forbidden/i;
const VALIDATION = /invalid|required|must be|bad request|400/i;
const CANCELLED = /cancelled|canceled|aborted/i;

export function classifyError(err: unknown, context?: { provider?: string }): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err);
  const provider = context?.provider;

  if (CANCELLED.test(message)) {
    return { class: 'cancelled', message, retryable: false, provider };
  }
  if (RATE_LIMIT.test(message)) {
    return { class: 'rate_limit', message, retryable: true, provider };
  }
  if (TIMEOUT.test(message)) {
    return { class: 'timeout', message, retryable: true, provider };
  }
  if (BUDGET.test(message)) {
    return { class: 'budget', message, retryable: false, provider };
  }
  if (SECURITY.test(message)) {
    return { class: 'security', message, retryable: false, provider };
  }
  if (VALIDATION.test(message)) {
    return { class: 'validation', message, retryable: false, provider };
  }
  if (/provider|api key|model|openai|anthropic|deepseek|gemini/i.test(message)) {
    return { class: 'provider', message, retryable: true, provider };
  }
  return { class: 'unknown', message, retryable: false, provider };
}

export function formatClassifiedError(error: ClassifiedError): string {
  return `[${error.class}] ${error.message}`;
}
