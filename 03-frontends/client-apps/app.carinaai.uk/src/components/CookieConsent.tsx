'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { initSentryIfConsented } from '@/lib/sentry-client';

export const COOKIE_CONSENT_KEY = 'carina_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      setVisible(true);
      return;
    }
    if (stored === 'accepted') {
      initSentryIfConsented();
    }
  }, []);

  function setConsent(value: 'accepted' | 'declined') {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setVisible(false);
    if (value === 'accepted') {
      initSentryIfConsented();
    }
    window.dispatchEvent(new CustomEvent('carina:cookie-consent', { detail: value }));
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-surface/95 p-4 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          We use cookies and analytics to improve your experience.{' '}
          <Link href="https://carinaai.uk/privacy/" className="text-accent underline">
            Privacy Policy
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setConsent('declined')}>
            Decline
          </Button>
          <Button type="button" size="sm" onClick={() => setConsent('accepted')}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

export function reopenCookieConsent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.location.reload();
}
