'use client';

import { COOKIE_CONSENT_KEY } from '@/components/CookieConsent';

let sentryStarted = false;

export function initSentryIfConsented(): void {
  if (sentryStarted || typeof window === 'undefined') return;
  if (window.localStorage.getItem(COOKIE_CONSENT_KEY) !== 'accepted') return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  void import('@sentry/nextjs').then((Sentry) => {
    if (sentryStarted) return;
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    sentryStarted = true;
  }).catch(() => {
    // Sentry optional; never block the app
  });
}

export function shutdownSentryClient(): void {
  sentryStarted = false;
}
