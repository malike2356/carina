'use client';

import { useEffect } from 'react';
import { COOKIE_CONSENT_KEY } from '@/components/CookieConsent';
import { initSentryIfConsented, shutdownSentryClient } from '@/lib/sentry-client';

export function SentryConsentLoader() {
  useEffect(() => {
    initSentryIfConsented();

    function onConsent(event: Event) {
      const detail = (event as CustomEvent<'accepted' | 'declined'>).detail;
      if (detail === 'accepted') {
        initSentryIfConsented();
      } else {
        shutdownSentryClient();
      }
    }

    window.addEventListener('carina:cookie-consent', onConsent);
    return () => window.removeEventListener('carina:cookie-consent', onConsent);
  }, []);

  return null;
}
