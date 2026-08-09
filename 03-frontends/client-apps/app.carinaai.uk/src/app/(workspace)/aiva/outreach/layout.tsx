'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { OutreachTabNav } from '@/components/outreach/OutreachTabNav';

export default function OutreachLayout({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/aiva/outreach/test-mode')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { banner?: string | null; testMode?: boolean } | null) => {
        if (data?.testMode && data.banner) setBanner(data.banner);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div
      className="workspace-page-fullbleed aiva-outreach-fullbleed flex w-full min-w-0 max-w-none flex-1 flex-col overflow-hidden"
      style={{ width: '100%', maxWidth: 'none' }}
    >
      {banner ? (
        <div
          role="status"
          className="shrink-0 border-b border-amber-700/40 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-950 dark:text-amber-100 lg:px-6"
        >
          {banner}
        </div>
      ) : null}
      <div className="w-full max-w-none shrink-0 border-b border-border px-4 pt-5 pb-0 lg:px-6">
        <h1 className="text-base font-semibold text-text-primary">CRM + outreach</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          See leads in a table, run campaigns under Soft Wall, and ask Aiva to contact them from chat or Telegram.
        </p>
        <OutreachTabNav />
      </div>
      <div
        className="min-h-0 w-full min-w-0 max-w-none flex-1 overflow-x-auto overflow-y-auto"
        style={{ width: '100%', maxWidth: 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
