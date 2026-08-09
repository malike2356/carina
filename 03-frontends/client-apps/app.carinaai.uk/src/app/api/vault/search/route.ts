import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { listVaultItems, searchVaultContent } from '@/lib/document-vault/pg-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim();
  const mode = String(url.searchParams.get('mode') || 'metadata').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100);

  if (!q) {
    return NextResponse.json({ data: { ok: true, query: q, mode, hits: [], count: 0 } });
  }

  if (mode === 'content') {
    const hits = await searchVaultContent(workspace.id, q, limit);
    return NextResponse.json({ data: { ok: true, query: q, mode: 'content', hits, count: hits.length } });
  }

  const listed = await listVaultItems(workspace.id, { q, scope: 'all' });
  return NextResponse.json({
    data: {
      ok: true,
      query: q,
      mode: 'metadata',
      items: listed.items.slice(0, limit),
      count: listed.total,
    },
  });
}
