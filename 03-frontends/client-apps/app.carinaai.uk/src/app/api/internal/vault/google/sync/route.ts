import { NextResponse } from 'next/server';
import { getDriveConnectionPublic } from '@/lib/document-vault/google/connection';
import { pushVaultItemToDrive, reconcileInbound } from '@/lib/document-vault/google/reconcile';
import { redactSecrets } from '@/lib/document-vault/google/verification-token';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }
  const actorId = typeof body.actorId === 'string' ? body.actorId : 'agent';
  const action = body.action === 'push' ? 'push' : 'reconcile';

  try {
    if (action === 'push') {
      const itemId = typeof body.itemId === 'string' ? body.itemId : '';
      if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
      const result = await pushVaultItemToDrive({ workspaceId, itemId, actorId });
      return NextResponse.json({ data: result });
    }
    const result = await reconcileInbound({
      workspaceId,
      source: 'manual',
      actorId,
    });
    const connection = await getDriveConnectionPublic(workspaceId);
    return NextResponse.json({ data: { result, connection } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ error: redactSecrets(message) as string }, { status: 400 });
  }
}
