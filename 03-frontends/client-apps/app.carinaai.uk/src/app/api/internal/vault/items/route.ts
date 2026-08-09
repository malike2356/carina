import { NextResponse } from 'next/server';
import {
  createVaultItem,
  listVaultItems,
  type VaultKind,
} from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const parentRaw = url.searchParams.get('parentId');
  const parentId =
    parentRaw === null || parentRaw === '' || parentRaw === 'root' ? null : parentRaw;
  const includeTrashed = url.searchParams.get('trashed') === '1';
  const q = url.searchParams.get('q') ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const scope = q ? 'all' : includeTrashed ? 'trash' : 'folder';

  const listed = await listVaultItems(workspaceId, {
    parentId: q ? undefined : parentId,
    includeTrashed,
    q,
    scope: q ? 'all' : scope,
  });
  return NextResponse.json({
    data: {
      items: listed.items.slice(0, limit),
      total: listed.total,
      parentId: q ? null : parentId,
    },
  });
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

  const kind = (typeof body.kind === 'string' ? body.kind : 'markdown') as VaultKind;
  try {
    const item = await createVaultItem({
      workspaceId,
      parentId: typeof body.parentId === 'string' ? body.parentId : null,
      kind,
      name: typeof body.name === 'string' ? body.name : 'Untitled',
      content: typeof body.content === 'string' ? body.content : kind === 'folder' ? undefined : '',
      actorId: typeof body.actorId === 'string' ? body.actorId : null,
    });
    return NextResponse.json({ data: item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 400 },
    );
  }
}
