import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export const dynamic = 'force-dynamic';

export interface ConfigCategoryOverview {
  category: string;
  total: number;
  configured: number;
  domains: Array<{ id: string; name: string; configured: boolean }>;
}

export interface CoreConfigOverview {
  totalDomains: number;
  configuredDomains: number;
  categories: ConfigCategoryOverview[];
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let workspaceId: string | null = null;
  try {
    const workspace = await requireWorkspace(session.user.id);
    workspaceId = workspace.id;
  } catch {
    // single-tenant installs have no workspace
  }

  if (!coreProxyEnabled()) {
    return NextResponse.json({ error: 'Core proxy not configured.' }, { status: 503 });
  }

  const token = resolveCoreProxyToken();
  const base = resolveCoreUrl().replace(/\/$/, '');
  const url = `${base}/api/internal/settings/overview`;

  const headers: Record<string, string> = {
    'x-internal-key': token,
  };
  if (workspaceId) headers['x-workspace-id'] = workspaceId;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return NextResponse.json({ error: 'Core config unavailable.' }, { status: res.status });
    }
    const data = (await res.json()) as CoreConfigOverview;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Could not reach Carina core.' }, { status: 503 });
  }
}
