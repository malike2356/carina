import { v4 as uuidv4 } from 'uuid';
import type { Memory, Role } from '../../types/index.js';
import type { MemoryBackend } from './types.js';

function createRemoteBackend(name: string, baseUrlEnv: string, apiKeyEnv: string): MemoryBackend {
  return {
    name,
    async saveMemory(sessionId, role, content) {
      const base = process.env[baseUrlEnv] ?? '';
      const key = process.env[apiKeyEnv] ?? '';
      if (!base) throw new Error(`${baseUrlEnv} not set`);
      await fetch(`${base.replace(/\/$/, '')}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, role, content }),
        signal: AbortSignal.timeout(10_000),
      });
    },
    async searchMemory(query, limit) {
      const base = process.env[baseUrlEnv] ?? '';
      const key = process.env[apiKeyEnv] ?? '';
      if (!base) return [];
      const url = new URL(`${base.replace(/\/$/, '')}/memories/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json() as { memories?: Array<Record<string, unknown>> };
      return (data.memories ?? []).map((m) => ({
        id: String(m.id ?? uuidv4()),
        sessionId: String(m.session_id ?? ''),
        role: (m.role ?? 'user') as Role,
        content: String(m.content ?? ''),
        createdAt: new Date(String(m.created_at ?? Date.now())),
      }));
    },
    async getSessionHistory(sessionId, limit) {
      const base = process.env[baseUrlEnv] ?? '';
      const key = process.env[apiKeyEnv] ?? '';
      if (!base) return [];
      const url = new URL(`${base.replace(/\/$/, '')}/memories/session/${encodeURIComponent(sessionId)}`);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json() as { memories?: Array<Record<string, unknown>> };
      return (data.memories ?? []).map((m) => ({
        id: String(m.id ?? uuidv4()),
        sessionId,
        role: (m.role ?? 'user') as Role,
        content: String(m.content ?? ''),
        createdAt: new Date(String(m.created_at ?? Date.now())),
      }));
    },
    async clearSession(sessionId) {
      const base = process.env[baseUrlEnv] ?? '';
      const key = process.env[apiKeyEnv] ?? '';
      if (!base) return;
      await fetch(`${base.replace(/\/$/, '')}/memories/session/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
    },
  };
}

export const honchoBackend = createRemoteBackend('honcho', 'HONCHO_URL', 'HONCHO_API_KEY');
export const mem0Backend = createRemoteBackend('mem0', 'MEM0_URL', 'MEM0_API_KEY');
