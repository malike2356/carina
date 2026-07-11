import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let workspaceId: string | null = null;
  try {
    const workspace = await requireWorkspace(session.user.id);
    workspaceId = workspace.id;
  } catch {
    // single-tenant
  }

  if (!coreProxyEnabled()) {
    return NextResponse.json({ error: 'Core proxy not configured.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => {})) as { domainId?: string } | undefined;
  const domainId = body?.domainId?.trim();
  if (!domainId) {
    return NextResponse.json({ error: 'domainId required.' }, { status: 400 });
  }

  const token = resolveCoreProxyToken();
  const base = resolveCoreUrl().replace(/\/$/, '');
  const url = `${base}/api/internal/settings/${encodeURIComponent(domainId)}/test`;

  const headers: Record<string, string> = {
    'x-internal-key': token,
    'Content-Type': 'application/json',
  };
  if (workspaceId) headers['x-workspace-id'] = workspaceId;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as unknown;
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: 'Could not reach Carina core.' }, { status: 503 });
  }
}
