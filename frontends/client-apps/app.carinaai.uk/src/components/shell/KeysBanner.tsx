'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

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
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
      <p>
        Add an API key to start chatting.{' '}
        <Link href="/settings/keys" className="font-medium text-amber-50 underline underline-offset-2">
          Open Settings &gt; Keys
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-amber-200 hover:bg-amber-500/20"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
