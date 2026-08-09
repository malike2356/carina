import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

/**
 * Idempotent: ensure core has an Aiva trial row for a new cloud workspace.
 * Safe to call from user signup; no-ops when core proxy is not configured.
 */
export async function provisionCoreAivaTrial(
  workspaceId: string,
  contact?: { email?: string; name?: string },
): Promise<{ ok: boolean; status: number; message: string; walletGrant?: { granted: boolean; pence: number }; trialEndsAt?: string; slotLimit?: number }> {
  if (!coreProxyEnabled()) {
    return { ok: true, status: 204, message: 'Core proxy disabled' };
  }

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
  const payload = {
    ownerEmail: contact?.email ?? '',
    ownerName: contact?.name ?? '',
    sendWelcome: true,
  };

  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(`${base}/api/aiva/subscription/trial`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const bodyText = await res.clone().text().catch(() => '');
      const data = await res.json().catch(() => null) as
        | { error?: string; trialEndsAt?: string; slotLimit?: number; walletGrant?: { granted?: boolean; pence?: number } }
        | null;
      if (!res.ok && res.status !== 409) {
        const text = data?.error || bodyText;
        lastError = String(text || `HTTP ${res.status}`);
        if (attempt === 2) {
          console.warn(
            `[aiva-provision] core trial provision failed for ${workspaceId}: HTTP ${res.status} ${lastError.slice(0, 200)}`,
          );
          return { ok: false, status: res.status, message: lastError.slice(0, 200) };
        }
        continue;
      }
      return {
        ok: true,
        status: res.status,
        message: res.status === 409 ? 'Already provisioned' : 'Trial provisioned',
        trialEndsAt: data?.trialEndsAt,
        slotLimit: data?.slotLimit,
        walletGrant: data?.walletGrant ? {
          granted: Boolean(data.walletGrant.granted),
          pence: Number(data.walletGrant.pence ?? 0),
        } : undefined,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === 2) {
        console.warn(`[aiva-provision] core trial provision failed for ${workspaceId}: ${lastError}`);
        return { ok: false, status: 0, message: lastError.slice(0, 200) };
      }
    }
  }

  return { ok: false, status: 0, message: lastError || 'Unknown error' };
}
