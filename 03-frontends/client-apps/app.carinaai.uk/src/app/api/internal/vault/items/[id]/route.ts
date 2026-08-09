import { NextResponse } from 'next/server';
import {
  copyVaultItem,
  getVaultContent,
  getVaultItem,
  listVaultRevisions,
  moveVaultItem,
  permanentDeleteVaultItem,
  renameVaultItem,
  restoreVaultItem,
  restoreVaultRevision,
  trashVaultItem,
  updateVaultContent,
} from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

export async function GET(request: Request, ctx: Ctx) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }
  const { id } = await ctx.params;
  const item = await getVaultItem(workspaceId, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (url.searchParams.get('revisions') === '1') {
    const revisions = await listVaultRevisions(workspaceId, id);
    return NextResponse.json({ data: { item, revisions } });
  }

  if (url.searchParams.get('content') === '1') {
    const content = await getVaultContent(workspaceId, id);
    return NextResponse.json({ data: { item, content: content ?? '' } });
  }

  return NextResponse.json({ data: item });
}

export async function POST(request: Request, ctx: Ctx) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
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
  if (body.action !== 'copy') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }
  try {
    const item = await copyVaultItem(
      workspaceId,
      id,
      typeof body.parentId === 'string' ? body.parentId : null,
      typeof body.actorId === 'string' ? body.actorId : null,
    );
    return NextResponse.json({ data: item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Copy failed' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
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
  const actorId = typeof body.actorId === 'string' ? body.actorId : null;

  try {
    if (body.action === 'restore') {
      const item = await restoreVaultItem(workspaceId, id, actorId);
      return NextResponse.json({ data: item });
    }
    if (body.action === 'restore_revision') {
      const revision = Number(body.revision);
      if (!Number.isFinite(revision)) {
        return NextResponse.json({ error: 'revision required' }, { status: 400 });
      }
      if (!String(body.approvalToken ?? '').trim()) {
        return NextResponse.json({ error: 'approvalToken required for revision restore' }, { status: 403 });
      }
      const item = await restoreVaultRevision(workspaceId, id, revision, actorId);
      return NextResponse.json({ data: item });
    }
    if (body.action === 'move' || body.parentId !== undefined) {
      const item = await moveVaultItem(
        workspaceId,
        id,
        typeof body.parentId === 'string' ? body.parentId : null,
        actorId,
      );
      return NextResponse.json({ data: item });
    }
    if (body.action === 'rename' || (typeof body.name === 'string' && body.content === undefined)) {
      const item = await renameVaultItem(workspaceId, id, String(body.name), actorId);
      return NextResponse.json({ data: item });
    }
    if (typeof body.content === 'string') {
      const item = await updateVaultContent({
        workspaceId,
        itemId: id,
        content: body.content,
        expectedRevision:
          body.expectedRevision != null ? Number(body.expectedRevision) : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
        actorId,
        mode: body.mode === 'append' ? 'append' : 'replace',
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

export async function DELETE(request: Request, ctx: Ctx) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const workspaceId =
    (typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '')
    || url.searchParams.get('workspaceId')?.trim()
    || '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }
  const actorId =
    (typeof body.actorId === 'string' ? body.actorId : null)
    || url.searchParams.get('actorId');

  try {
    if (body.permanent === true) {
      if (!String(body.approvalToken ?? '').trim()) {
        return NextResponse.json({ error: 'approvalToken required' }, { status: 403 });
      }
      await permanentDeleteVaultItem(workspaceId, id);
      return NextResponse.json({ data: { deleted: true, id } });
    }
    await trashVaultItem(workspaceId, id, actorId);
    return NextResponse.json({ data: { trashed: true, id } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 400 },
    );
  }
}
