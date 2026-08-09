import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  FORMAT_CAPABILITIES,
  breadcrumbsFor,
  createVaultItem,
  listVaultItems,
  migrateLegacyDocuments,
  type VaultKind,
} from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);

  if (url.searchParams.get('capabilities') === '1') {
    return NextResponse.json({ data: FORMAT_CAPABILITIES });
  }

  if (url.searchParams.get('migrate') === '1') {
    const result = await migrateLegacyDocuments(workspace.id);
    return NextResponse.json({ data: result });
  }

  const parentRaw = url.searchParams.get('parentId');
  const parentId = parentRaw === null || parentRaw === '' || parentRaw === 'root' ? null : parentRaw;
  const includeTrashed = url.searchParams.get('trashed') === '1';
  const q = url.searchParams.get('q') ?? undefined;
  const scopeParam = url.searchParams.get('scope');
  const scope =
    scopeParam === 'all' || scopeParam === 'favorites' || scopeParam === 'trash' || scopeParam === 'folder'
      ? scopeParam
      : includeTrashed
        ? 'trash'
        : 'folder';

  const listed = await listVaultItems(workspace.id, { parentId, includeTrashed, q, scope });
  const breadcrumbs =
    scope === 'folder' && parentId ? await breadcrumbsFor(workspace.id, parentId) : [];
  return NextResponse.json({
    data: {
      ...listed,
      breadcrumbs,
      parentId: scope === 'folder' ? parentId : null,
      scope,
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    kind?: VaultKind;
    name?: string;
    parentId?: string | null;
    content?: string;
  };

  const kind = (body.kind ?? 'markdown') as VaultKind;
  try {
    const item = await createVaultItem({
      workspaceId: workspace.id,
      parentId: body.parentId ?? null,
      kind,
      name: body.name ?? 'Untitled',
      content: body.content ?? (kind === 'spreadsheet' ? 'col1,col2\n,' : ''),
      actorId: session.user.id,
    });
    return NextResponse.json({ data: item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 400 },
    );
  }
}
