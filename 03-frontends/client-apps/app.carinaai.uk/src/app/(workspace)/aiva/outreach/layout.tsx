import type { ReactNode } from 'react';
import { OutreachTabNav } from '@/components/outreach/OutreachTabNav';

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="aiva-outreach-fullbleed flex w-full min-w-0 max-w-none flex-1 flex-col overflow-hidden"
      style={{ width: '100%', maxWidth: 'none' }}
    >
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
