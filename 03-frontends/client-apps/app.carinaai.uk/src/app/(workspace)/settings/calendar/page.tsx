import { Suspense } from 'react';
import { CalendarConnectionPanel } from '@/components/integrations/CalendarConnectionPanel';

export default function CalendarSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[90rem] px-6 py-8 text-xs text-text-muted">
          Loading calendar settings…
        </div>
      }
    >
      <CalendarConnectionPanel />
    </Suspense>
  );
}
