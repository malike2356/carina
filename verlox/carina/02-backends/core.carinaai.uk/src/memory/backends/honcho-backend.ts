import { v4 as uuidv4 } from 'uuid';
import type { Memory, Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';

function honchoBaseUrl(): string {
  return (process.env.HONCHO_URL ?? 'https://api.honcho.dev').replace(/\/$/, '');
}

function honchoApiKey(): string {
  return process.env.HONCHO_API_KEY ?? '';
}

function honchoWorkspace(): string {
  return process.env.HONCHO_WORKSPACE_ID ?? process.env.HONCHO_WORKSPACE ?? 'carina';
}

function honchoPeerId(): string {
  return process.env.HONCHO_PEER_ID ?? 'user';
}

function honchoHeaders(): Record<string, string> {
  const key = honchoApiKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

function wsPath(suffix: string): string {
  return `${honchoBaseUrl()}/v2/workspaces/${encodeURIComponent(honchoWorkspace())}${suffix}`;
}

function mapHonchoMessage(m: Record<string, unknown>, sessionId: string): Memory {
  return {
    id: String(m.id ?? uuidv4()),
    sessionId,
    role: String((m.metadata as Record<string, unknown> | undefined)?.role ?? m.role ?? 'user') as Role,
    content: String(m.content ?? m.text ?? ''),
    createdAt: new Date(String(m.created_at ?? m.timestamp ?? Date.now())),
  };
}

async function ensureSession(sessionId: string): Promise<void> {
  await fetch(wsPath(`/sessions/${encodeURIComponent(sessionId)}`), {
    method: 'PUT',
    headers: honchoHeaders(),
    body: JSON.stringify({ id: sessionId }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

export const honchoBackend: MemoryBackend = {
  name: 'honcho',
  displayName: 'Honcho',
  description: 'Honcho peer-centric memory (managed or self-hosted)',
  isConfigured() {
    return Boolean(honchoApiKey() || process.env.HONCHO_URL);
  },
  requiredEnv() {
    return ['HONCHO_API_KEY'];
  },
  async saveMemory(sessionId, role, content) {
    await ensureSession(sessionId);
    const res = await fetch(wsPath(`/sessions/${encodeURIComponent(sessionId)}/messages`), {
      method: 'POST',
      headers: honchoHeaders(),
      body: JSON.stringify({
        messages: [{
          peer_id: honchoPeerId(),
          content,
          metadata: { role, source: 'carina' },
        }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Honcho save failed: ${res.status} ${await res.text()}`);
    }
  },
  async searchMemory(query, limit) {
    const res = await fetch(wsPath('/search'), {
      method: 'POST',
      headers: honchoHeaders(),
      body: JSON.stringify({ query, limit, peer_id: honchoPeerId() }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<Record<string, unknown>>; messages?: Array<Record<string, unknown>> };
    const rows = data.results ?? data.messages ?? [];
    return rows.map((m) => mapHonchoMessage(m, String(m.session_id ?? 'honcho')));
  },
  async getSessionHistory(sessionId, limit, before?) {
    const url = new URL(wsPath(`/sessions/${encodeURIComponent(sessionId)}/messages`));
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url, { headers: honchoHeaders(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = await res.json() as { messages?: Array<Record<string, unknown>>; results?: Array<Record<string, unknown>> };
    const rows = data.messages ?? data.results ?? (Array.isArray(data) ? data as Array<Record<string, unknown>> : []);
    let memories = rows.map((m) => mapHonchoMessage(m, sessionId));
    if (before) {
      memories = memories.filter((m) => m.createdAt < before);
    }
    return memories.slice(-limit);
  },
  async clearSession(sessionId) {
    await fetch(wsPath(`/sessions/${encodeURIComponent(sessionId)}`), {
      method: 'DELETE',
      headers: honchoHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
  },
  async listRecentMemories(limit) {
    const res = await fetch(wsPath('/search'), {
      method: 'POST',
      headers: honchoHeaders(),
      body: JSON.stringify({ query: '', limit, peer_id: honchoPeerId() }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    return (data.results ?? []).map((m) => mapHonchoMessage(m, String(m.session_id ?? 'honcho')));
  },
};
