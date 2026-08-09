import type { ReactNode } from 'react';
import { OutreachTabNav } from '@/components/outreach/OutreachTabNav';

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 pt-5 pb-0 lg:px-6">
        <h1 className="text-base font-semibold text-text-primary">CRM + outreach</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          See leads in a table, run campaigns under Soft Wall, and ask Aiva to contact them from chat or Telegram.
        </p>
        <OutreachTabNav />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
