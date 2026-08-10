/**
 * Error boundaries for routes, jobs, webhooks, and payments.
 * Express types are structural; products may pass real Express Request/Response.
 */
import { createPublicError } from './public-error-handler.js';
import { logError, type ErrorLogContext } from './private-error-logger.js';

export type MinimalRequest = {
  originalUrl?: string;
  url?: string;
  method?: string;
  body?: unknown;
  user?: { id?: string };
  sessionID?: string;
};

export type MinimalResponse = {
  headersSent: boolean;
  status: (code: number) => MinimalResponse;
  json: (body: unknown) => unknown;
};

type NextFn = (err?: unknown) => void;
type AsyncRoute = (
  req: MinimalRequest,
  res: MinimalResponse,
  next: NextFn,
) => unknown | Promise<unknown>;

function baseContext(req?: Partial<MinimalRequest>, extra?: Partial<ErrorLogContext>): ErrorLogContext {
  return {
    route: req?.originalUrl ?? req?.url,
    method: req?.method,
    userId: req?.user?.id ?? null,
    sessionId: req?.sessionID ?? null,
    requestBody: req?.body,
    environment: process.env.NODE_ENV,
    ...extra,
  };
}

export function sendPublicError(
  res: MinimalResponse,
  error: unknown,
  statusCode = 500,
  userMessage?: string,
  context?: ErrorLogContext,
): string {
  const pub = createPublicError(error, userMessage, statusCode);
  logError(error, { ...context, statusCode: pub.statusCode }, pub.reference);
  if (!res.headersSent) {
    res.status(pub.statusCode).json(pub.body);
  }
  return pub.reference;
}

/** Express async route wrapper: catch → private log → public JSON. */
export function errorBoundary(handler: AsyncRoute): AsyncRoute {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      const status =
        typeof (error as { statusCode?: number })?.statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : typeof (error as { status?: number })?.status === 'number'
            ? (error as { status: number }).status
            : 500;
      sendPublicError(res, error, status, undefined, {
        ...baseContext(req, { boundary: 'route' }),
      });
    }
  };
}

/** Express 4-arg error middleware. */
export function expressErrorMiddleware(
  err: unknown,
  req: MinimalRequest,
  res: MinimalResponse,
  _next: NextFn,
): void {
  const status =
    typeof (err as { statusCode?: number })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : 500;
  sendPublicError(res, err, status >= 400 ? status : 500, undefined, {
    ...baseContext(req, { boundary: 'express-middleware' }),
  });
}

export async function jobErrorBoundary<T>(
  jobName: string,
  job: () => Promise<T> | T,
): Promise<{ ok: true; value: T } | { ok: false; reference: string }> {
  try {
    return { ok: true, value: await job() };
  } catch (error) {
    const pub = createPublicError(error, undefined, 500);
    logError(error, { boundary: 'job', route: jobName, statusCode: 500 }, pub.reference);
    return { ok: false, reference: pub.reference };
  }
}

export async function webhookErrorBoundary<T>(
  webhookName: string,
  webhook: () => Promise<T> | T,
  opts?: { req?: Partial<MinimalRequest>; res?: MinimalResponse },
): Promise<{ ok: true; value: T } | { ok: false; reference: string }> {
  try {
    return { ok: true, value: await webhook() };
  } catch (error) {
    if (opts?.res) {
      const reference = sendPublicError(opts.res, error, 500, undefined, {
        ...baseContext(opts.req, { boundary: 'webhook', route: webhookName }),
      });
      return { ok: false, reference };
    }
    const pub = createPublicError(error, undefined, 500);
    logError(
      error,
      { ...baseContext(opts?.req, { boundary: 'webhook', route: webhookName }), statusCode: 500 },
      pub.reference,
    );
    return { ok: false, reference: pub.reference };
  }
}

export async function paymentErrorBoundary<T>(
  callbackName: string,
  callback: () => Promise<T> | T,
  opts?: { req?: Partial<MinimalRequest>; res?: MinimalResponse },
): Promise<{ ok: true; value: T } | { ok: false; reference: string }> {
  try {
    return { ok: true, value: await callback() };
  } catch (error) {
    if (opts?.res) {
      const reference = sendPublicError(opts.res, error, 500, undefined, {
        ...baseContext(opts.req, { boundary: 'payment', route: callbackName }),
      });
      return { ok: false, reference };
    }
    const pub = createPublicError(error, undefined, 500);
    logError(
      error,
      { ...baseContext(opts?.req, { boundary: 'payment', route: callbackName }), statusCode: 500 },
      pub.reference,
    );
    return { ok: false, reference: pub.reference };
  }
}

let globalInstalled = false;

export function globalUncaughtHandler(): void {
  if (globalInstalled) return;
  globalInstalled = true;
  process.on('uncaughtException', (error) => {
    logError(error, { boundary: 'uncaughtException', statusCode: 500 });
    console.error('[uncaughtException]', error.message);
  });
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logError(error, { boundary: 'unhandledRejection', statusCode: 500 });
    console.error('[unhandledRejection]', error.message);
  });
}
