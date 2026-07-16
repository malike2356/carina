import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

/**
 * Idempotent: ensure core has an Aiva trial row for a new cloud workspace.
 * Safe to call from user signup; no-ops when core proxy is not configured.
 */
export async function provisionCoreAivaTrial(
  workspaceId: string,
  contact?: { email?: string; name?: string },
): Promise<void> {
  if (!coreProxyEnabled()) return;

  const token = resolveCoreProxyToken();
  const headers: Record<string, string> = {
    'X-Workspace-Id': workspaceId,
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }

  const base = resolveCoreUrl().replace(/\/$/, '');
  const res = await fetch(`${base}/api/aiva/subscription/trial`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ownerEmail: contact?.email ?? '',
      ownerName: contact?.name ?? '',
      sendWelcome: true,
    }),
  });

  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '');
    console.warn(
      `[aiva-provision] core trial provision failed for ${workspaceId}: HTTP ${res.status} ${text.slice(0, 200)}`,
    );
  }
}
