import { NextResponse } from 'next/server';
import { workspaceFeatureService } from '@/lib/workspace-feature-service';
import {
  type WorkspaceFeatureKey,
  featureRequiredForPath,
} from '@/lib/workspace-features';

/**
 * Route-level enforcement. Returns 404 when the feature is disabled for the workspace.
 * 404 (not 403): the feature does not exist in this workspace.
 */
export async function requireWorkspaceFeature(
  workspaceId: string,
  feature: WorkspaceFeatureKey,
): Promise<NextResponse | null> {
  const enabled = await workspaceFeatureService.isEnabled(workspaceId, feature);
  if (enabled) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function requireWorkspaceFeatureForPath(
  workspaceId: string,
  pathname: string,
): Promise<NextResponse | null> {
  const feature = featureRequiredForPath(pathname);
  if (!feature) return null;
  return requireWorkspaceFeature(workspaceId, feature);
}
