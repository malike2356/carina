'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'carina_keys_banner_dismissed';

export function KeysBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY) === '1') {
      setLoading(false);
      return;
    }

    fetch('/api/chat/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const needsByok = !data.hasKeys && !data.proxyEnabled;
        setVisible(Boolean(needsByok));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (loading || !visible) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b px-4 py-2 text-sm',
        warnTone.boxSoft,
        warnTone.text,
      )}
    >
      <p>
        Add an API key to start chatting.{' '}
        <Link href="/settings/keys" className={warnTone.link}>
          Open Settings &gt; Keys
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className={cn('shrink-0 rounded p-1', warnTone.dismiss)}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
