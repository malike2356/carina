/** Optional sync of engine switches to Aiva PHP (C03 durable settings). */

import { readAgentEngineState } from './store.js';
import type { AgentEngineName } from './types.js';

function aivaBase(): string {
  return (
    process.env.AIVA_ENGINE_API_URL
    ?? process.env.AIVA_APP_URL
    ?? process.env.CARINA_AIVA_URL
    ?? ''
  ).replace(/\/$/, '');
}

function opsToken(): string {
  return (
    process.env.AIVA_OPS_ENGINE_TOKEN
    ?? process.env.CARINA_OPS_TOKEN
    ?? ''
  ).trim();
}

async function phpFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const base = aivaBase();
  const token = opsToken();
  if (!base || !token) return null;
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Carina-Ops-Token', token);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function syncPhpGlobalEngine(engine: AgentEngineName): Promise<{ ok: boolean; detail?: string }> {
  const res = await phpFetch('/api/admin/agent-engine/switch-all', {
    method: 'POST',
    body: JSON.stringify({ engine }),
  });
  if (!res) return { ok: false, detail: 'PHP bridge not configured' };
  if (!res.ok) return { ok: false, detail: `PHP HTTP ${res.status}` };
  return { ok: true };
}

export async function syncPhpWorkspaceEngine(
  workspaceId: string,
  engine: AgentEngineName,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await phpFetch(`/api/admin/agent-engine/workspaces/${encodeURIComponent(workspaceId)}/switch`, {
    method: 'POST',
    body: JSON.stringify({ engine }),
  });
  if (!res) return { ok: false, detail: 'PHP bridge not configured' };
  if (!res.ok) return { ok: false, detail: `PHP HTTP ${res.status}` };
  return { ok: true };
}

export async function syncPhpConfig(patch: Record<string, unknown>): Promise<{ ok: boolean; detail?: string }> {
  const res = await phpFetch('/api/admin/agent-engine/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res) return { ok: false, detail: 'PHP bridge not configured' };
  if (!res.ok) return { ok: false, detail: `PHP HTTP ${res.status}` };
  return { ok: true };
}

export async function fetchPhpWorkspaces(): Promise<Array<{
  id: string;
  name: string;
  engine: AgentEngineName;
  status: string;
}> | null> {
  const res = await phpFetch('/api/admin/agent-engine/workspaces');
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { workspaces?: unknown };
    if (!Array.isArray(body.workspaces)) return null;
    return body.workspaces
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const engine = String(r.engine ?? '').toLowerCase();
        if (engine !== 'keprix' && engine !== 'carina') return null;
        return {
          id: String(r.id ?? ''),
          name: String(r.name ?? r.id ?? ''),
          engine: engine as AgentEngineName,
          status: String(r.status ?? 'active'),
        };
      })
      .filter((x): x is { id: string; name: string; engine: AgentEngineName; status: string } => Boolean(x?.id));
  } catch {
    return null;
  }
}

export function phpBridgeConfigured(): boolean {
  return Boolean(aivaBase() && opsToken());
}

export function currentKeprixUrlHint(): string {
  return readAgentEngineState().config.keprix_url;
}
