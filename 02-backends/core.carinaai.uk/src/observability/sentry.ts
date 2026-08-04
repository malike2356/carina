import type { ErrorEvent, EventHint } from '@sentry/node';

let initialized = false;

function stripPiiFromEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN_CORE?.trim());
}

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN_CORE?.trim();
  if (!dsn || initialized) return;

  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
    beforeSend(event: ErrorEvent, _hint: EventHint) {
      return stripPiiFromEvent(event);
    },
  });
  initialized = true;
}

export async function captureException(error: unknown): Promise<void> {
  if (!isSentryEnabled()) return;
  const Sentry = await import('@sentry/node');
  Sentry.captureException(error);
}

export async function setupExpressErrorHandler(
  app: { use: (...args: unknown[]) => unknown },
): Promise<void> {
  if (!isSentryEnabled()) return;
  const Sentry = await import('@sentry/node');
  Sentry.setupExpressErrorHandler(app);
}
