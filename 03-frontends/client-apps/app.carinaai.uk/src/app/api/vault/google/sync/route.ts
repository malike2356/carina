import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { getDriveConnectionPublic } from '@/lib/document-vault/google/connection';
import { reconcileInbound, pushVaultItemToDrive } from '@/lib/document-vault/google/reconcile';
import { renewDriveWatchIfNeeded, registerDriveWatch } from '@/lib/document-vault/google/watch';
import { redactSecrets } from '@/lib/document-vault/google/verification-token';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    action?: 'reconcile' | 'push' | 'renew-watch' | 'register-watch';
    itemId?: string;
  };

  try {
    if (body.action === 'push') {
      if (!body.itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
      const result = await pushVaultItemToDrive({
        workspaceId: workspace.id,
        itemId: body.itemId,
        actorId: session.user.id,
      });
      return NextResponse.json({ data: result });
    }
    if (body.action === 'renew-watch') {
      const result = await renewDriveWatchIfNeeded(workspace.id);
      return NextResponse.json({ data: result });
    }
    if (body.action === 'register-watch') {
      const result = await registerDriveWatch(workspace.id);
      return NextResponse.json({ data: result });
    }

    const result = await reconcileInbound({
      workspaceId: workspace.id,
      source: 'manual',
      actorId: session.user.id,
    });
    const connection = await getDriveConnectionPublic(workspace.id);
    return NextResponse.json({ data: { result, connection } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ error: redactSecrets(message) as string }, { status: 400 });
  }
}
