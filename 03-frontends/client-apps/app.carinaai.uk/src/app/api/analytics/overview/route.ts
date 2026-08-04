import { getSession, requireWorkspace } from '@/lib/session';
import { buildAnalyticsOverview } from '@/lib/analytics-overview';
import { requireWorkspaceFeature } from '@/lib/require-workspace-feature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await requireWorkspace(session.user.id);
  const blocked = await requireWorkspaceFeature(workspace.id, 'activity_analytics');
  if (blocked) return blocked;
  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days') ?? 30);
  const overview = await buildAnalyticsOverview(workspace.id, Number.isFinite(days) ? days : 30);
  return Response.json({ data: overview });
}
