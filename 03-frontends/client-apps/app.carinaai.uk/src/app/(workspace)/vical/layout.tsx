import type { ReactNode } from 'react';
import { VicalTabNav } from '@/components/vical/VicalTabNav';

export default function VicalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="workspace-page-fullbleed flex w-full min-w-0 max-w-none flex-1 flex-col overflow-hidden"
      style={{ width: '100%', maxWidth: 'none' }}
    >
      <div className="w-full max-w-none shrink-0 border-b border-border px-4 pt-5 pb-0 sm:px-6">
        <h1 className="text-base font-semibold text-text-primary">viCal Bookings</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Event types, availability, and public booking. Google sync stays under Calendar settings.
        </p>
        <VicalTabNav />
      </div>
      <div className="min-h-0 w-full min-w-0 max-w-none flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
