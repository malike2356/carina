import { Router } from 'express';
import { carinaDelete, carinaGet, carinaJson, carinaOpsTokenSet, carinaPost, carinaPut } from '../lib/carina.js';

export const mcpRouter = Router();

type McpServerRow = {
  name: string;
  transport: 'stdio' | 'http';
  command?: string | null;
  args?: string[];
  url?: string | null;
  env?: Record<string, string> | null;
  connected?: boolean;
  connectedAt?: string | null;
  liveConnected?: boolean;
  tools?: string[];
};

type McpIndexPayload = {
  servers: McpServerRow[];
  summary?: { configured?: number; liveConnections?: number };
};

type McpTestPayload = {
  ok: boolean;
  durationMs?: number;
  tools?: Array<{ name: string; description?: string }>;
  error?: string;
};

function trim(value: unknown): string {
  return String(value ?? '').trim();
}

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  const text = trim(raw);
  if (!text) return [];
  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function parseEnv(raw: unknown): Record<string, string> | undefined {
  if (typeof raw === 'object' && raw && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => [key.trim(), String(value).trim()] as const)
      .filter(([key, value]) => key && value);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  const text = trim(raw);
  if (!text) return undefined;
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('=');
      if (idx <= 0) return null;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key || !value) return null;
      return [key, value] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function proxyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function fetchServers(): Promise<McpIndexPayload | null> {
  const response = await carinaGet('/api/mcp');
  const payload = await carinaJson<McpIndexPayload>(response);
  if (!payload.ok || !payload.data) return null;
  return payload.data;
}

mcpRouter.get('/', async (req, res) => {
  const coreConnected = carinaOpsTokenSet();
  const payload = coreConnected ? await fetchServers() : null;
  res.render('mcp', {
    title: 'MCP Servers',
    coreConnected,
    payload,
    reloadOk: req.query.ok === '1',
    reloadErr: typeof req.query.err === 'string' ? req.query.err : '',
  });
});

mcpRouter.post('/add', async (req, res) => {
  try {
    const transport = trim(req.body?.transport).toLowerCase();
    const name = trim(req.body?.name);
    if (!name) throw new Error('name is required');
    if (transport !== 'stdio' && transport !== 'http') throw new Error('transport must be stdio or http');

    const body = transport === 'http'
      ? {
          name,
          transport: 'http',
          url: trim(req.body?.url),
        }
      : {
          name,
          transport: 'stdio',
          command: trim(req.body?.command),
          args: parseList(req.body?.args),
          env: parseEnv(req.body?.env),
        };

    const response = await carinaPost('/api/mcp', body);
    const payload = await carinaJson<{ error?: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Failed to add MCP server');
    res.redirect('/mcp?ok=1');
  } catch (err) {
    res.redirect('/mcp?err=' + encodeURIComponent(proxyError(err)));
  }
});

mcpRouter.post('/:id/save', async (req, res) => {
  try {
    const id = trim(req.params.id);
    const transport = trim(req.body?.transport).toLowerCase();
    if (!id) throw new Error('id is required');
    if (transport !== 'stdio' && transport !== 'http') throw new Error('transport must be stdio or http');

    const body = transport === 'http'
      ? {
          name: trim(req.body?.name) || id,
          transport: 'http',
          url: trim(req.body?.url),
        }
      : {
          name: trim(req.body?.name) || id,
          transport: 'stdio',
          command: trim(req.body?.command),
          args: parseList(req.body?.args),
          env: parseEnv(req.body?.env),
        };

    const response = await carinaPut(`/api/mcp/${encodeURIComponent(id)}`, body);
    const payload = await carinaJson<{ error?: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Failed to update MCP server');
    res.redirect('/mcp?ok=1');
  } catch (err) {
    res.redirect('/mcp?err=' + encodeURIComponent(proxyError(err)));
  }
});

mcpRouter.post('/:id/test', async (req, res) => {
  try {
    const id = trim(req.params.id);
    if (!id) throw new Error('id is required');
    const response = await carinaPost(`/api/mcp/${encodeURIComponent(id)}/test`, {});
    const payload = await carinaJson<McpTestPayload>(response);
    if (!response.ok) throw new Error(payload.error ?? 'Ping failed');
    const duration = typeof payload.data?.durationMs === 'number' ? `${payload.data.durationMs}ms` : 'ok';
    res.redirect('/mcp?ok=' + encodeURIComponent(duration));
  } catch (err) {
    res.redirect('/mcp?err=' + encodeURIComponent(proxyError(err)));
  }
});

mcpRouter.post('/:id/delete', async (req, res) => {
  try {
    const id = trim(req.params.id);
    if (!id) throw new Error('id is required');
    const response = await carinaDelete(`/api/mcp/${encodeURIComponent(id)}`);
    if (response.status === 204) {
      res.redirect('/mcp?ok=1');
      return;
    }
    if (!response.ok) {
      const payload = await carinaJson<{ error?: string }>(response);
      throw new Error(payload.error ?? 'Failed to delete MCP server');
    }
    res.redirect('/mcp?ok=1');
  } catch (err) {
    res.redirect('/mcp?err=' + encodeURIComponent(proxyError(err)));
  }
});
