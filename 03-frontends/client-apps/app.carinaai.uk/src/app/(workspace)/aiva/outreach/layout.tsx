import type { ReactNode } from 'react';
import { OutreachTabNav } from '@/components/outreach/OutreachTabNav';

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 pt-5 pb-0">
        <h1 className="text-base font-semibold text-text-primary">Sales engagement</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Lead intake, campaigns, Soft Wall sequences, and content channels (YouTube). No mass-send without approval.
        </p>
        <OutreachTabNav />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
