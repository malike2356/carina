import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { opsToken } from '../ops/ops-config.js';
import {
  markMcpServerPing,
  readMcpServers,
  removeMcpServer,
  upsertMcpServer,
  type PersistedMcpServer,
} from '../mcp/config.js';
import { connectServer, disconnectServer, listConnections } from '../mcp/registry.js';
import { McpHttpClient } from '../mcp/http-client.js';
import { McpStdioClient } from '../mcp/stdio-client.js';
import type { McpServerConfig, McpToolDefinition } from '../mcp/types.js';
import { callMcpTool } from '../mcp/registry.js';

export const mcpApiRouter: ExpressRouter = Router();

type McpApiRequest = Request & { tenantId?: string };

function resolveExpectedInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

function isMcpApiAuthorized(req: McpApiRequest): boolean {
  if (isControlAuthorized(req)) return true;
  const headerKey = String(req.headers['x-internal-key'] ?? '').trim();
  if (!headerKey) return false;
  const expected = resolveExpectedInternalKey();
  if (expected && headerKey === expected) return true;
  const ops = opsToken();
  return Boolean(ops && headerKey === ops);
}

function authMiddleware(req: McpApiRequest, res: Response, next: NextFunction): void {
  if (!isMcpApiAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.tenantId = '__operator__';
  next();
}

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof raw !== 'string') return [];
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // fall through to line parsing
    }
  }
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEnv(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>)
      .map(([key, value]) => [key.trim(), String(value).trim()] as const)
      .filter(([key, value]) => key && value);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      return parseEnv(parsed);
    } catch {
      // fall through to key=value parsing
    }
  }
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

function parseEnabled(raw: unknown, fallback = true): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (['false', '0', 'off', 'no'].includes(value)) return false;
    if (['true', '1', 'on', 'yes'].includes(value)) return true;
  }
  return fallback;
}

function enabledFromBody(body: Record<string, unknown>, fallback = true): boolean {
  return parseEnabled(body.enabled, fallback);
}

function normalizeConfigBody(
  body: Record<string, unknown>,
  fallbackName?: string,
): { config: McpServerConfig; name: string } {
  const name = String(body.name ?? fallbackName ?? '').trim();
  if (!name) {
    throw new Error('name is required');
  }

  const transport = String(body.transport ?? 'stdio').trim().toLowerCase();
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error('transport must be stdio or http');
  }

  if (transport === 'http') {
    const url = String(body.url ?? '').trim();
    if (!url) throw new Error('url is required for http transport');
    return {
      name,
      config: {
        name,
        transport,
        url,
      },
    };
  }

  const command = String(body.command ?? '').trim();
  if (!command) throw new Error('command is required for stdio transport');

  return {
    name,
    config: {
      name,
      transport,
      command,
      args: parseList(body.args),
      env: parseEnv(body.env),
    },
  };
}

function liveConnectionFor(name: string) {
  return listConnections().find((connection) => connection.name === name) ?? null;
}

function mapServer(server: PersistedMcpServer) {
  const live = liveConnectionFor(server.name);
  const connected = Boolean(live || server.connected);
  return {
    name: server.name,
    transport: server.transport,
    command: server.command ?? null,
    args: server.args ?? [],
    url: server.url ?? null,
    env: server.env ?? null,
    enabled: server.enabled,
    lastPing: server.lastPing ?? null,
    lastPingMs: server.lastPingMs ?? null,
    savedConnected: Boolean(server.connected),
    liveConnected: Boolean(live),
    connected,
    connectedAt: live?.connectedAt?.toISOString() ?? server.connectedAt ?? null,
    tools: live?.tools?.map((tool) => tool.name) ?? server.tools ?? [],
  };
}

function mergeConfigBody(
  base: PersistedMcpServer | null,
  body: Record<string, unknown>,
  fallbackName?: string,
): { config: PersistedMcpServer; name: string } {
  const name = String(body.name ?? fallbackName ?? base?.name ?? '').trim();
  if (!name) {
    throw new Error('name is required');
  }
  const transport = String(body.transport ?? base?.transport ?? 'stdio').trim().toLowerCase();
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error('transport must be stdio or http');
  }
  const enabled = parseEnabled(body.enabled, base?.enabled ?? true);
  if (transport === 'http') {
    const url = String(body.url ?? base?.url ?? '').trim();
    if (!url) throw new Error('url is required for http transport');
    return {
      name,
      config: {
        name,
        transport,
        url,
        command: undefined,
        args: [],
        env: undefined,
        enabled,
        connected: false,
        connectedAt: undefined,
        tools: [],
        lastPing: base?.lastPing,
        lastPingMs: base?.lastPingMs,
      },
    };
  }

  const command = String(body.command ?? base?.command ?? '').trim();
  if (!command) throw new Error('command is required for stdio transport');

  return {
    name,
    config: {
      name,
      transport,
      command,
      args: parseList(body.args ?? base?.args),
      env: parseEnv(body.env ?? base?.env),
      url: undefined,
      enabled,
      connected: false,
      connectedAt: undefined,
      tools: [],
      lastPing: base?.lastPing,
      lastPingMs: base?.lastPingMs,
    },
  };
}

async function connectTemporarily(config: McpServerConfig): Promise<McpToolDefinition[]> {
  if (config.transport === 'http') {
    const client = new McpHttpClient(config.name, config.url ?? '');
    try {
      return await client.connect();
    } finally {
      await client.disconnect().catch(() => undefined);
    }
  }

  const client = new McpStdioClient(
    config.name,
    config.command ?? '',
    config.args ?? [],
    config.env ?? {},
  );
  try {
    return await client.connect();
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

mcpApiRouter.use(authMiddleware);

mcpApiRouter.get('/', async (_req: McpApiRequest, res: Response) => {
  try {
    const servers = await readMcpServers();
    res.json({
      servers: servers.map(mapServer),
      summary: {
        configured: servers.length,
        liveConnections: listConnections().length,
      },
      source: 'persisted',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.post('/', async (req: McpApiRequest, res: Response) => {
  try {
    const { config, name } = normalizeConfigBody((req.body ?? {}) as Record<string, unknown>);
    const servers = await readMcpServers();
    if (servers.some((server) => server.name === name)) {
      res.status(409).json({ error: `MCP server already exists: ${name}` });
      return;
    }
    const next: PersistedMcpServer = {
      ...config,
      enabled: enabledFromBody((req.body ?? {}) as Record<string, unknown>, true),
      connected: false,
      connectedAt: undefined,
      tools: [],
    };
    await upsertMcpServer(next);
    res.status(201).json({ server: mapServer(next) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.patch('/:id', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const servers = await readMcpServers();
    const current = servers.find((server) => server.name === id);
    if (!current) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    const { config, name } = mergeConfigBody(current, (req.body ?? {}) as Record<string, unknown>, id);
    if (name !== id && servers.some((server) => server.name === name)) {
      res.status(409).json({ error: `MCP server already exists: ${name}` });
      return;
    }
    if (config.enabled === false) {
      await disconnectServer(id).catch(() => undefined);
    }
    await upsertMcpServer(config);
    if (name !== id) {
      await removeMcpServer(id);
    }
    res.json({ server: mapServer(config) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.put('/:id', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const { config, name } = normalizeConfigBody((req.body ?? {}) as Record<string, unknown>, id);
    const servers = await readMcpServers();
    const idx = servers.findIndex((server) => server.name === id);
    if (idx < 0) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    const renamedConflict = name !== id && servers.some((server) => server.name === name);
    if (renamedConflict) {
      res.status(409).json({ error: `MCP server already exists: ${name}` });
      return;
    }
    await disconnectServer(id).catch(() => undefined);
    const updated: PersistedMcpServer = {
      ...config,
      enabled: enabledFromBody((req.body ?? {}) as Record<string, unknown>, true),
      connected: false,
      connectedAt: undefined,
      tools: [],
    };
    servers.splice(idx, 1, updated);
    await upsertMcpServer(updated);
    if (name !== id) {
      await removeMcpServer(id);
    }
    res.json({ server: mapServer(updated) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.delete('/:id', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    await disconnectServer(id).catch(() => undefined);
    const ok = await removeMcpServer(id);
    if (!ok) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.get('/:id/tools', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const servers = await readMcpServers();
    const server = servers.find((item) => item.name === id);
    if (!server) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    const live = liveConnectionFor(id);
    res.json({
      name: id,
      liveConnected: Boolean(live),
      tools: live?.tools?.map((tool) => tool.name) ?? server.tools ?? [],
      source: live ? 'live' : 'persisted',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.post('/:id/connect', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const servers = await readMcpServers();
    const current = servers.find((item) => item.name === id);
    if (!current) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    const { config, name } = mergeConfigBody(current, (req.body ?? {}) as Record<string, unknown>, id);
    if (name !== id && servers.some((server) => server.name === name)) {
      res.status(409).json({ error: `MCP server already exists: ${name}` });
      return;
    }
    const connection = await connectServer(config);
    const connectedAt = connection.connectedAt.toISOString();
    const updated: PersistedMcpServer = {
      ...config,
      enabled: enabledFromBody((req.body ?? {}) as Record<string, unknown>, true),
      connected: true,
      connectedAt,
      tools: connection.tools.map((tool) => tool.name),
      lastPing: current.lastPing,
      lastPingMs: current.lastPingMs,
    };
    await upsertMcpServer(updated);
    if (name !== id) {
      await removeMcpServer(id);
    }
    res.json({
      ok: true,
      server: mapServer(updated),
      tools: connection.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.post('/:id/disconnect', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const servers = await readMcpServers();
    const current = servers.find((item) => item.name === id);
    if (!current) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }
    const ok = await disconnectServer(id);
    if (!ok) {
      res.status(409).json({ error: `server not connected: ${id}` });
      return;
    }
    const updated: PersistedMcpServer = {
      ...current,
      connected: false,
      connectedAt: undefined,
    };
    await upsertMcpServer(updated);
    res.json({ ok: true, server: mapServer(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

mcpApiRouter.post('/:id/call', async (req: McpApiRequest, res: Response) => {
  try {
    const id = String(req.params.id ?? '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const tool = String(body.tool ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    if (!tool) {
      res.status(400).json({ error: 'tool is required' });
      return;
    }
    const args = body.arguments && typeof body.arguments === 'object' && !Array.isArray(body.arguments)
      ? (body.arguments as Record<string, unknown>)
      : {};
    const result = await callMcpTool(id, tool, args);
    res.json({ ok: true, server: id, tool, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('not connected') ? 409 : 400;
    res.status(code).json({ error: message });
  }
});

async function handlePing(req: McpApiRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '').trim();
    const servers = await readMcpServers();
    const saved = servers.find((item) => item.name === id);
    const override = (req.body ?? {}) as Record<string, unknown>;
    const mergedBody = {
      name: override.name ?? saved?.name ?? id,
      transport: override.transport ?? saved?.transport,
      command: override.command ?? saved?.command,
      args: override.args ?? saved?.args,
      url: override.url ?? saved?.url,
      env: override.env ?? saved?.env,
    };
    const { config } = normalizeConfigBody(mergedBody, id);
    const startedAt = Date.now();
    const tools = await connectTemporarily(config);
    const durationMs = Date.now() - startedAt;
    await markMcpServerPing(id, durationMs, tools.map((tool) => tool.name)).catch(() => undefined);
    res.json({
      ok: true,
      testedAt: new Date().toISOString(),
      durationMs,
      transport: config.transport,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

mcpApiRouter.post('/:id/ping', handlePing);
mcpApiRouter.post('/:id/test', handlePing);
