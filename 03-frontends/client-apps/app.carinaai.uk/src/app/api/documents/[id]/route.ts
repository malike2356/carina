import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { normalizeDocumentHtml } from '@/components/editor/markdown-normalize';
import {
  getVaultContent,
  getVaultItem,
  trashVaultItem,
  updateVaultContent,
} from '@/lib/document-vault/pg-store';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function getOwnedDocument(userId: string, documentId: string) {
  const workspace = await requireWorkspace(userId);
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, doc: doc ?? null };
}

function vaultAsLegacyDoc(
  item: NonNullable<Awaited<ReturnType<typeof getVaultItem>>>,
  content: string,
) {
  const format =
    item.kind === 'html' || item.kind === 'rich_document'
      ? 'html'
      : item.kind === 'markdown'
        ? 'markdown'
        : 'markdown';
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    title: item.name,
    content,
    format,
    archived: Boolean(item.trashedAt),
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    source: 'document_vault',
    kind: item.kind,
    currentRevision: item.currentRevision,
    syncStatus: item.syncStatus ?? null,
    conflict: item.conflict ?? false,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { workspace, doc } = await getOwnedDocument(session.user.id, id);
  if (doc) return NextResponse.json({ data: doc });

  const vaultItem = await getVaultItem(workspace.id, id);
  if (!vaultItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const content = (await getVaultContent(workspace.id, id)) ?? '';
  return NextResponse.json({ data: vaultAsLegacyDoc(vaultItem, content) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { workspace, doc } = await getOwnedDocument(session.user.id, id);
  const body = (await request.json()) as {
    title?: string;
    content?: string;
    format?: string;
    archived?: boolean;
    sessionId?: string | null;
    expectedRevision?: number;
  };

  if (!doc) {
    const vaultItem = await getVaultItem(workspace.id, id);
    if (!vaultItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
      if (typeof body.content === 'string' || typeof body.title === 'string') {
        const content =
          typeof body.content === 'string'
            ? body.format === 'html' || vaultItem.kind === 'html' || vaultItem.kind === 'rich_document'
              ? normalizeDocumentHtml(body.content)
              : body.content
            : ((await getVaultContent(workspace.id, id)) ?? '');
        const updated = await updateVaultContent({
          workspaceId: workspace.id,
          itemId: id,
          content,
          expectedRevision: body.expectedRevision,
          name: typeof body.title === 'string' ? body.title : undefined,
          actorId: session.user.id,
        });
        const nextContent = (await getVaultContent(workspace.id, id)) ?? content;
        return NextResponse.json({ data: vaultAsLegacyDoc(updated, nextContent) });
      }
      if (body.archived === true) {
        await trashVaultItem(workspace.id, id, session.user.id);
        const item = await getVaultItem(workspace.id, id);
        return NextResponse.json({
          data: vaultAsLegacyDoc(item!, (await getVaultContent(workspace.id, id)) ?? ''),
        });
      }
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      const status = /stale/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const updates: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.trim() || 'Untitled';
  if (typeof body.content === 'string') {
    updates.content = normalizeDocumentHtml(body.content);
    updates.format = 'html';
  }
  if (typeof body.format === 'string' && updates.content === undefined) {
    const format = body.format.trim().toLowerCase();
    if (format === 'markdown' || format === 'html') updates.format = format;
  }
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (body.sessionId !== undefined) updates.sessionId = body.sessionId;

  const [updated] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { workspace, doc } = await getOwnedDocument(session.user.id, id);
  if (doc) {
    await db.delete(documents).where(eq(documents.id, id));
    return NextResponse.json({ data: { ok: true } });
  }

  const vaultItem = await getVaultItem(workspace.id, id);
  if (!vaultItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await trashVaultItem(workspace.id, id, session.user.id);
  return NextResponse.json({ data: { ok: true } });
}
