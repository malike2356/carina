import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  workspaceFeatureService,
} from '@/lib/workspace-feature-service';
import {
  WORKSPACE_FEATURE_CATEGORY_LABELS,
  type WorkspaceFeatureCategory,
} from '@/lib/workspace-features';
import { getSession, requireWorkspace } from '@/lib/session';
import { isWorkspaceOwner } from '@/lib/terminal-access';

export const dynamic = 'force-dynamic';

function groupFeatures(
  features: Awaited<ReturnType<typeof workspaceFeatureService.listFeatures>>,
) {
  const order: WorkspaceFeatureCategory[] = ['core', 'workspace', 'ai', 'analytics'];
  return order.map((category) => ({
    category,
    label: WORKSPACE_FEATURE_CATEGORY_LABELS[category],
    features: features.filter((feature) => feature.category === category),
  }));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const features = await workspaceFeatureService.listFeatures(workspace.id);
  const owner = await isWorkspaceOwner(workspace.id, session.user.id);

  return NextResponse.json({
    features,
    groups: groupFeatures(features),
    canManage: owner,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const owner = await isWorkspaceOwner(workspace.id, session.user.id);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== 'reset') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const incoming = await headers();
  const overrides = await workspaceFeatureService.resetOverrides({
    workspaceId: workspace.id,
    userId: session.user.id,
    ip: incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip'),
  });
  const features = await workspaceFeatureService.listFeatures(workspace.id);

  return NextResponse.json({
    ok: true,
    overrides,
    features,
    groups: groupFeatures(features),
  });
}
