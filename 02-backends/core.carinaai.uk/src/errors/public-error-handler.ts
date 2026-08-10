import { randomUUID } from 'node:crypto';

export type PublicErrorBody = {
  error: {
    message: string;
    reference: string;
  };
};

export type PublicErrorResult = {
  reference: string;
  statusCode: number;
  message: string;
  body: PublicErrorBody;
};

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Something wasn't right with your request",
  401: 'Please log in again',
  403: "You don't have access to that",
  404: "We couldn't find that",
  409: 'That change conflicted with a newer update',
  422: "Something wasn't right with your request",
  429: 'Too many requests; please slow down and try again',
  500: "Something went wrong on our end; we're on it",
  502: "Something went wrong on our end; we're on it",
  503: 'Service temporarily unavailable; please try again shortly',
};

const LEAK_PATTERNS = [
  /postgres(ql)?:\/\//i,
  /mysql:\/\//i,
  /mongodb(\+srv)?:\/\//i,
  /redis:\/\//i,
  /stack\s*trace/i,
  /at\s+\S+\s+\([^)]+\.(ts|js|py):\d+/i,
  /\/home\/|\/Users\/|\/var\/www\/|C:\\/i,
  /ECONNREFUSED|ENOENT|ETIMEDOUT/i,
  /API[_-]?KEY|SECRET[_-]?KEY|password\s*=/i,
];

export function getPublicMessage(statusCode: number): string {
  return DEFAULT_MESSAGES[statusCode] ?? DEFAULT_MESSAGES[500]!;
}

export function isUnsafePublicMessage(message: string): boolean {
  const text = String(message || '');
  if (!text.trim()) return true;
  return LEAK_PATTERNS.some((re) => re.test(text));
}

export function createPublicError(
  error: unknown,
  userMessage?: string,
  statusCode = 500,
): PublicErrorResult {
  const reference = randomUUID();
  let message = (userMessage ?? getPublicMessage(statusCode)).trim();
  if (isUnsafePublicMessage(message)) {
    message = getPublicMessage(statusCode);
  }
  // Never echo raw Error.message for 5xx.
  if (statusCode >= 500 && userMessage && isUnsafePublicMessage(userMessage)) {
    message = getPublicMessage(statusCode);
  }
  if (statusCode >= 500 && !userMessage) {
    message = getPublicMessage(statusCode);
  }
  void error;
  return {
    reference,
    statusCode,
    message,
    body: errorResponse(statusCode, message, reference),
  };
}

export function errorResponse(
  statusCode: number,
  publicMessage: string,
  errorReference: string,
): PublicErrorBody {
  const message = isUnsafePublicMessage(publicMessage)
    ? getPublicMessage(statusCode)
    : publicMessage;
  return {
    error: {
      message,
      reference: errorReference,
    },
  };
}

export function assertNoStackInPublicBody(body: unknown): boolean {
  const raw = JSON.stringify(body ?? {});
  return !/stack/i.test(raw) && !LEAK_PATTERNS.some((re) => re.test(raw));
}
