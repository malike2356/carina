export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dsn = process.env.SENTRY_DSN_ADMIN?.trim() || process.env.SENTRY_DSN?.trim();
    if (!dsn) return;
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
        }
        return event;
      },
    });
  }
}
