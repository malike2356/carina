import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  assertWorkspaceFeatureKey,
  workspaceFeatureService,
} from '@/lib/workspace-feature-service';
import { getSession, requireWorkspace } from '@/lib/session';
import { isWorkspaceOwner } from '@/lib/terminal-access';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ feature: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const owner = await isWorkspaceOwner(workspace.id, session.user.id);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { feature: rawFeature } = await context.params;
  let featureKey;
  try {
    featureKey = assertWorkspaceFeatureKey(rawFeature);
  } catch {
    return NextResponse.json({ error: 'Unknown feature' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }

  try {
    const incoming = await headers();
    const result = await workspaceFeatureService.setOverride({
      workspaceId: workspace.id,
      userId: session.user.id,
      feature: featureKey,
      enabled: body.enabled,
      ip: incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip'),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update feature' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const owner = await isWorkspaceOwner(workspace.id, session.user.id);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { feature: rawFeature } = await context.params;
  let featureKey;
  try {
    featureKey = assertWorkspaceFeatureKey(rawFeature);
  } catch {
    return NextResponse.json({ error: 'Unknown feature' }, { status: 404 });
  }

  try {
    const incoming = await headers();
    const result = await workspaceFeatureService.removeOverride({
      workspaceId: workspace.id,
      userId: session.user.id,
      feature: featureKey,
      ip: incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip'),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not remove override' },
      { status: 400 },
    );
  }
}
