import { v4 as uuidv4 } from 'uuid';
import type { Memory, Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';

type Mem0Mode = 'cloud' | 'oss';

function mem0Mode(): Mem0Mode {
  if (process.env.MEM0_MODE === 'oss' || process.env.MEM0_URL) return 'oss';
  return 'cloud';
}

function mem0BaseUrl(): string {
  if (mem0Mode() === 'oss') {
    return (process.env.MEM0_URL ?? 'http://localhost:8000').replace(/\/$/, '');
  }
  return (process.env.MEM0_BASE_URL ?? 'https://api.mem0.ai').replace(/\/$/, '');
}

function mem0ApiKey(): string {
  return process.env.MEM0_API_KEY ?? '';
}

function mem0Headers(): Record<string, string> {
  const key = mem0ApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) {
    headers.Authorization = mem0Mode() === 'cloud' ? `Token ${key}` : `Bearer ${key}`;
  }
  return headers;
}

function userIdForSession(sessionId: string): string {
  return process.env.MEM0_USER_ID ?? sessionId;
}

function mapMem0Row(m: Record<string, unknown>, sessionId: string): Memory {
  return {
    id: String(m.id ?? uuidv4()),
    sessionId: String(m.user_id ?? m.session_id ?? sessionId),
    role: (m.role ?? 'user') as Role,
    content: String(m.memory ?? m.content ?? m.text ?? ''),
    createdAt: new Date(String(m.created_at ?? Date.now())),
  };
}

async function mem0Add(sessionId: string, role: Role, content: string): Promise<void> {
  const base = mem0BaseUrl();
  const userId = userIdForSession(sessionId);

  if (mem0Mode() === 'cloud') {
    const res = await fetch(`${base}/v3/memories/add/`, {
      method: 'POST',
      headers: mem0Headers(),
      body: JSON.stringify({
        messages: [{ role, content }],
        user_id: userId,
        metadata: { session_id: sessionId, source: 'carina' },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Mem0 add failed: ${res.status} ${await res.text()}`);
    }
    return;
  }

  const res = await fetch(`${base}/memories`, {
    method: 'POST',
    headers: mem0Headers(),
    body: JSON.stringify({
      messages: [{ role, content }],
      user_id: userId,
      session_id: sessionId,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Mem0 OSS add failed: ${res.status} ${await res.text()}`);
  }
}

async function mem0Search(query: string, limit: number, sessionId?: string): Promise<Memory[]> {
  const base = mem0BaseUrl();
  const userId = sessionId ? userIdForSession(sessionId) : (process.env.MEM0_USER_ID ?? 'default');

  if (mem0Mode() === 'cloud') {
    const res = await fetch(`${base}/v3/memories/search/`, {
      method: 'POST',
      headers: mem0Headers(),
      body: JSON.stringify({
        query,
        filters: { user_id: userId },
        limit,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    return (data.results ?? []).map((m) => mapMem0Row(m, sessionId ?? userId));
  }

  const url = new URL(`${base}/memories/search`);
  url.searchParams.set('query', query);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { headers: mem0Headers(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = await res.json() as { memories?: Array<Record<string, unknown>>; results?: Array<Record<string, unknown>> };
  const rows = data.memories ?? data.results ?? [];
  return rows.map((m) => mapMem0Row(m, sessionId ?? userId));
}

async function mem0ListSession(sessionId: string, limit: number): Promise<Memory[]> {
  const base = mem0BaseUrl();
  const userId = userIdForSession(sessionId);

  if (mem0Mode() === 'cloud') {
    const res = await fetch(`${base}/v3/memories/`, {
      method: 'POST',
      headers: mem0Headers(),
      body: JSON.stringify({
        filters: { user_id: userId },
        page_size: limit,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<Record<string, unknown>> };
    return (data.results ?? []).map((m) => mapMem0Row(m, sessionId));
  }

  const url = new URL(`${base}/memories`);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { headers: mem0Headers(), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = await res.json() as { memories?: Array<Record<string, unknown>> };
  return (data.memories ?? []).map((m) => mapMem0Row(m, sessionId));
}

export const mem0Backend: MemoryBackend = {
  name: 'mem0',
  displayName: 'Mem0',
  description: 'Mem0 cloud or self-hosted memory layer (vector + fact extraction)',
  isConfigured() {
    return mem0Mode() === 'oss' ? Boolean(process.env.MEM0_URL) : Boolean(mem0ApiKey());
  },
  requiredEnv() {
    return mem0Mode() === 'oss'
      ? ['MEM0_URL']
      : ['MEM0_API_KEY'];
  },
  saveMemory: mem0Add,
  searchMemory(query, limit) {
    return mem0Search(query, limit);
  },
  getSessionHistory(sessionId, limit, _before?) {
    return mem0ListSession(sessionId, limit);
  },
  async clearSession(sessionId) {
    const base = mem0BaseUrl();
    const userId = userIdForSession(sessionId);
    if (mem0Mode() === 'cloud') {
      await fetch(`${base}/v1/memories/?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: mem0Headers(),
        signal: AbortSignal.timeout(15_000),
      });
      return;
    }
    await fetch(`${base}/memories?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: mem0Headers(),
      signal: AbortSignal.timeout(15_000),
    });
  },
  listRecentMemories(limit) {
    return mem0ListSession(process.env.MEM0_USER_ID ?? 'default', limit);
  },
};
