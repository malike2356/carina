import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const scoutKey = keys.find((key) => key.provider === 'labyrinth-scout');
  const active = Boolean(scoutKey?.apiKey);

  return NextResponse.json({
    active,
    tier: workspace.plan ?? 'free',
    plan: workspace.plan ?? null,
    status: active ? 'connected' : 'not_connected',
    instanceId: active ? workspace.id : undefined,
    scoutKeyMasked: active ? 'configured' : undefined,
    events: [],
    instances: [],
  });
}
