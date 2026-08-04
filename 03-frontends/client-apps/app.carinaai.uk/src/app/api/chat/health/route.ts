import { NextResponse } from 'next/server';
import { listWorkspaceKeys } from '@/lib/keys';
import { getCloudCapabilities } from '@/lib/cloud-capabilities';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await listWorkspaceKeys(workspace.id);
  const hasKeys = keys.length > 0;
  const proxyEnabled = coreProxyEnabled();

  let proxyReachable: boolean | undefined;
  if (proxyEnabled) {
    const coreUrl = resolveCoreUrl();
    const token = resolveCoreProxyToken();
    try {
      const res = await fetch(new URL('/api/health', coreUrl).toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      proxyReachable = res.ok;
    } catch {
      proxyReachable = false;
    }
  }

  const chatMode = hasKeys ? 'byok-direct' : proxyEnabled ? 'core-proxy' : 'byok-direct';
  const chatReady = hasKeys || (proxyEnabled && proxyReachable === true);

  return NextResponse.json({
    ok: chatReady,
    hasKeys,
    proxyEnabled,
    proxyReachable,
    chatMode,
    capabilities: getCloudCapabilities(),
  });
}
