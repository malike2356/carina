'use client';

import { useEffect, useState } from 'react';

const WIDGET_SCRIPT = '/api/embed/widget.js?v=4';
const CORE_API_BASE =
  process.env.NEXT_PUBLIC_CARINA_CORE_URL?.replace(/\/$/, '') || 'https://core.carinaai.uk';

type Props = {
  workerId: string;
};

export function WidgetPreviewLoader({ workerId }: Props) {
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    function fail(message: string) {
      if (!cancelled) setError(message);
    }

    setError('');

    document.getElementById('carina-widget-host')?.remove();
    document.getElementById('carina-widget-loader')?.remove();

    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<{ workerId?: string }>).detail;
      if (detail?.workerId && detail.workerId !== workerId) return;
      if (!cancelled) setError('');
    };

    const onWidgetError = (event: Event) => {
      const detail = (event as CustomEvent<{ workerId?: string; message?: string }>).detail;
      if (detail?.workerId && detail.workerId !== workerId) return;
      fail(detail?.message ?? 'The chat widget failed to start.');
    };

    window.addEventListener('carina-widget-ready', onReady);
    window.addEventListener('carina-widget-error', onWidgetError);

    const script = document.createElement('script');
    script.id = 'carina-widget-loader';
    script.src = WIDGET_SCRIPT;
    script.setAttribute('data-aiva-id', workerId);
    script.setAttribute('data-api-base', CORE_API_BASE);
    script.async = true;

    script.onerror = () => {
      fail('Could not load the chat widget. Try refreshing this page.');
    };

    const timeout = window.setTimeout(() => {
      if (cancelled || document.getElementById('carina-widget-host')) return;
      fail(
        'Widget did not appear. Confirm Web chat is connected, this Aiva is active, and try again in a few seconds.',
      );
    }, 12000);

    document.body.appendChild(script);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('carina-widget-ready', onReady);
      window.removeEventListener('carina-widget-error', onWidgetError);
      script.remove();
      document.getElementById('carina-widget-host')?.remove();
    };
  }, [workerId]);

  if (!error) return null;

  return (
    <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  );
}
