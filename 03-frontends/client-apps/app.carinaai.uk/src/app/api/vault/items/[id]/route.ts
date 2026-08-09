import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  getVaultContent,
  getVaultItem,
  listVaultRevisions,
  moveVaultItem,
  renameVaultItem,
  restoreVaultItem,
  setVaultFavorite,
  trashVaultItem,
  updateVaultContent,
} from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const { id } = await ctx.params;
  const url = new URL(request.url);

  const item = await getVaultItem(workspace.id, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (url.searchParams.get('revisions') === '1') {
    const revisions = await listVaultRevisions(workspace.id, id);
    return NextResponse.json({ data: { item, revisions } });
  }

  const content = await getVaultContent(workspace.id, id);
  return NextResponse.json({ data: { item, content } });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    content?: string;
    name?: string;
    expectedRevision?: number;
    parentId?: string | null;
    favorite?: boolean;
    action?: 'move' | 'rename' | 'restore' | 'favorite';
  };

  try {
    if (body.action === 'restore') {
      const item = await restoreVaultItem(workspace.id, id, session.user.id);
      return NextResponse.json({ data: item });
    }
    if (body.action === 'favorite' || typeof body.favorite === 'boolean') {
      const item = await setVaultFavorite(
        workspace.id,
        id,
        Boolean(body.favorite),
        session.user.id,
      );
      return NextResponse.json({ data: item });
    }
    if (body.action === 'move' || body.parentId !== undefined) {
      const item = await moveVaultItem(
        workspace.id,
        id,
        body.parentId ?? null,
        session.user.id,
      );
      return NextResponse.json({ data: item });
    }
    if (body.action === 'rename' || (body.name && body.content === undefined)) {
      const item = await renameVaultItem(workspace.id, id, String(body.name), session.user.id);
      return NextResponse.json({ data: item });
    }
    if (body.content !== undefined) {
      const item = await updateVaultContent({
        workspaceId: workspace.id,
        itemId: id,
        content: String(body.content),
        expectedRevision: body.expectedRevision,
        name: body.name,
        actorId: session.user.id,
      });
      return NextResponse.json({ data: item });
    }
    return NextResponse.json({ error: 'No changes' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    const status = /stale/i.test(message) ? 409 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const { id } = await ctx.params;
  try {
    await trashVaultItem(workspace.id, id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trash failed' },
      { status: 400 },
    );
  }
}
