'use client';

import { AivaAnalyticsDashboard } from '@/components/aiva/AivaAnalyticsDashboard';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { useProductSurface } from '@/hooks/useProductSurface';

export default function AnalyticsPage() {
  const surface = useProductSurface();

  if (surface === 'aiva') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <AivaAnalyticsDashboard />
        </div>
      </div>
    );
  }

  return <AnalyticsDashboard />;
}
