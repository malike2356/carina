import type { ReactNode } from 'react';
import { VicalTabNav } from '@/components/vical/VicalTabNav';

export default function VicalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 pt-5 pb-0">
        <h1 className="text-base font-semibold text-text-primary">viCal Bookings</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Event types, availability, and public booking. Google sync stays under Calendar settings.
        </p>
        <VicalTabNav />
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
