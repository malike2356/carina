'use client';

import { AivaAnalyticsDashboard } from '@/components/aiva/AivaAnalyticsDashboard';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { WorkspaceFeatureGate } from '@/components/workspace/WorkspaceFeatureGate';
import { useProductSurface } from '@/hooks/useProductSurface';

export default function AnalyticsPage() {
  const surface = useProductSurface();

  return (
    <WorkspaceFeatureGate
      feature="activity_analytics"
      title="Analytics unavailable"
      subtitle="Activity analytics are turned off for this workspace. Enable them in Settings > Features."
    >
      {surface === 'aiva' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="w-full min-w-0 max-w-none px-4 py-6 sm:px-6 lg:px-8">
            <AivaAnalyticsDashboard />
          </div>
        </div>
      ) : (
        <AnalyticsDashboard />
      )}
    </WorkspaceFeatureGate>
  );
}
