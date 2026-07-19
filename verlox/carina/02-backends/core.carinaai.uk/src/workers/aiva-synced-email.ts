/**
 * Fetch synced Email page rows from the Aiva app (email_messages).
 */

function resolveAppBaseUrl(): string {
  return (
    process.env.AIVA_APP_PUBLIC_URL
    ?? process.env.AIVA_APP_URL
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://admin.hireaiva.co.uk'
  )
    .trim()
    .replace(/\/$/, '');
}

async function appFetch(
  pathWithQuery: string,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) {
    return { ok: false, status: 503, json: { error: 'CARINA_INTERNAL_KEY not set' } };
  }
  const url = `${resolveAppBaseUrl()}${pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-internal-key': key },
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      json: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

export async function listSyncedEmails(input: {
  workspaceId: string;
  q?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  if (input.q) params.set('q', input.q);
  if (input.status) params.set('status', input.status);
  if (input.source) params.set('source', input.source);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  params.set('limit', String(Math.min(30, Math.max(1, input.limit ?? 10))));

  const result = await appFetch(`/api/internal/email/messages?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export async function getSyncedEmail(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({
    workspaceId: input.workspaceId,
    id: input.id,
  });
  const result = await appFetch(`/api/internal/email/messages?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}
