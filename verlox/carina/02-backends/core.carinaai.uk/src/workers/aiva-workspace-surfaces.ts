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
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) {
    return { ok: false, status: 503, json: { error: 'CARINA_INTERNAL_KEY not set' } };
  }
  const url = `${resolveAppBaseUrl()}${pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': key,
        ...(init?.headers ?? {}),
      },
      signal: init?.signal ?? AbortSignal.timeout(30000),
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

export async function createWorkspaceResearchJob(input: {
  workspaceId: string;
  query: string;
  mode?: string;
  rounds?: number;
}): Promise<{ ok: boolean; data?: unknown; openUrl?: string; error?: string }> {
  const result = await appFetch('/api/internal/research/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return {
    ok: true,
    data: result.json.data,
    openUrl: typeof result.json.openUrl === 'string' ? result.json.openUrl : undefined,
  };
}

export async function listWorkspaceResearchJobs(input: {
  workspaceId: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(50, Math.max(1, input.limit ?? 10))));
  const result = await appFetch(`/api/internal/research/jobs?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export async function createWorkspaceDocument(input: {
  workspaceId: string;
  title: string;
  content: string;
  format?: 'markdown' | 'plain';
}): Promise<{ ok: boolean; data?: unknown; openUrl?: string; error?: string }> {
  const result = await appFetch('/api/internal/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return {
    ok: true,
    data: result.json.data,
    openUrl: typeof result.json.openUrl === 'string' ? result.json.openUrl : undefined,
  };
}

export async function listWorkspaceDocuments(input: {
  workspaceId: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(100, Math.max(1, input.limit ?? 20))));
  const result = await appFetch(`/api/internal/documents?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}

export async function getWorkspaceInventory(input: {
  workspaceId: string;
  limit?: number;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  params.set('limit', String(Math.min(50, Math.max(1, input.limit ?? 10))));
  const result = await appFetch(`/api/internal/workspace/inventory?${params}`);
  if (!result.ok) {
    return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
  }
  return { ok: true, data: result.json.data };
}
