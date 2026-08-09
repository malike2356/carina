/**
 * Cloud Document Vault surfaces for agent tools (prompt 712).
 * Calls app.carinaai.uk internal vault APIs with x-internal-key.
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

function fail(result: { ok: boolean; status: number; json: Record<string, unknown> }): {
  ok: false;
  error: string;
} {
  return { ok: false, error: String(result.json.error ?? `HTTP ${result.status}`) };
}

export async function vaultList(input: {
  workspaceId: string;
  parentId?: string | null;
  limit?: number;
  q?: string;
  includeTrashed?: boolean;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  if (input.parentId != null) params.set('parentId', input.parentId);
  if (input.q) params.set('q', input.q);
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.includeTrashed) params.set('trashed', '1');
  const result = await appFetch(`/api/internal/vault/items?${params}`);
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultGet(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}?${params}`);
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultRead(input: {
  workspaceId: string;
  id: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId, content: '1' });
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}?${params}`);
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultCreate(input: {
  workspaceId: string;
  kind: string;
  name: string;
  content?: string;
  parentId?: string | null;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch('/api/internal/vault/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultUpdate(input: {
  workspaceId: string;
  id: string;
  content: string;
  expectedRevision?: number;
  name?: string;
  mode?: 'replace' | 'append';
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      content: input.content,
      expectedRevision: input.expectedRevision,
      name: input.name,
      mode: input.mode ?? 'replace',
      actorId: input.actorId,
    }),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultPatch(input: {
  workspaceId: string;
  id: string;
  action: 'rename' | 'move' | 'restore';
  name?: string;
  parentId?: string | null;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      action: input.action,
      name: input.name,
      parentId: input.parentId,
      actorId: input.actorId,
    }),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultCopy(input: {
  workspaceId: string;
  id: string;
  parentId?: string | null;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      action: 'copy',
      parentId: input.parentId ?? null,
      actorId: input.actorId,
    }),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultTrash(input: {
  workspaceId: string;
  id: string;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  if (input.actorId) params.set('actorId', input.actorId);
  const result = await appFetch(
    `/api/internal/vault/items/${encodeURIComponent(input.id)}?${params}`,
    { method: 'DELETE' },
  );
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data ?? { trashed: true } };
}

export async function vaultRevisions(input: {
  workspaceId: string;
  id: string;
  restoreRevision?: number;
  approvalToken?: string;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (input.restoreRevision != null) {
    const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        action: 'restore_revision',
        revision: input.restoreRevision,
        approvalToken: input.approvalToken,
        actorId: input.actorId,
      }),
    });
    if (!result.ok) return fail(result);
    return { ok: true, data: result.json.data };
  }
  const params = new URLSearchParams({ workspaceId: input.workspaceId, revisions: '1' });
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}?${params}`);
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultPermanentDelete(input: {
  workspaceId: string;
  id: string;
  approvalToken: string;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch(`/api/internal/vault/items/${encodeURIComponent(input.id)}`, {
    method: 'DELETE',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      permanent: true,
      approvalToken: input.approvalToken,
      actorId: input.actorId,
    }),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data ?? { deleted: true } };
}

export async function vaultSyncStatus(input: {
  workspaceId: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const params = new URLSearchParams({ workspaceId: input.workspaceId });
  const result = await appFetch(`/api/internal/vault/google/connection?${params}`);
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}

export async function vaultSyncRequest(input: {
  workspaceId: string;
  action: 'reconcile' | 'push';
  itemId?: string;
  actorId?: string;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await appFetch('/api/internal/vault/google/sync', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) return fail(result);
  return { ok: true, data: result.json.data };
}
