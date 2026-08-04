'use client';

import type { ReactNode } from 'react';
import { useWorkspaceFeatureEnabled } from '@/hooks/useWorkspaceFeatures';
import type { WorkspaceFeatureKey } from '@/lib/workspace-features';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

export function WorkspaceFeatureGate({
  feature,
  children,
  title = 'Feature unavailable',
  subtitle = 'This feature is turned off for this workspace.',
}: {
  feature: WorkspaceFeatureKey;
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const { loading, enabled } = useWorkspaceFeatureEnabled(feature, true);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState title={title} subtitle={subtitle} />
      </div>
    );
  }

  return <>{children}</>;
}
