import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  resolveConflictKeepGoogle,
  resolveConflictKeepLocal,
} from '@/lib/document-vault/google/reconcile';
import { redactSecrets } from '@/lib/document-vault/google/verification-token';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const { id } = await ctx.params;
  const body = (await request.json()) as { choice?: 'local' | 'google' };

  try {
    if (body.choice === 'google') {
      await resolveConflictKeepGoogle({
        workspaceId: workspace.id,
        itemId: id,
        actorId: session.user.id,
      });
    } else if (body.choice === 'local') {
      await resolveConflictKeepLocal({
        workspaceId: workspace.id,
        itemId: id,
        actorId: session.user.id,
      });
    } else {
      return NextResponse.json({ error: 'choice must be local or google' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resolve failed';
    return NextResponse.json({ error: redactSecrets(message) as string }, { status: 400 });
  }
}
