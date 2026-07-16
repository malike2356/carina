import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, initDb } from '../memory/db.js';
import { resolveCarinaHome } from '../config/paths.js';
import type { McpServerConfig } from '../mcp/types.js';
import { McpHttpClient } from '../mcp/http-client.js';
import { McpStdioClient } from '../mcp/stdio-client.js';

export type PersistedMcpServer = McpServerConfig & {
  enabled: boolean;
  lastPing?: string;
  lastPingMs?: number;
  connected?: boolean;
  connectedAt?: string;
  tools?: string[];
};

type McpServerRow = {
  id: string;
  name: string;
  url: string | null;
  command: string | null;
  args: unknown;
  env: unknown;
  enabled: boolean;
  last_ping: string | null;
  last_ping_ms: number | null;
  created_at: string;
};

type LegacyMcpFile = {
  servers?: PersistedMcpServer[];
};

function legacyPath(): string {
  return path.join(resolveCarinaHome(), 'mcp', 'servers.json');
}

function normalizeArgs(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeEnv(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>)
    .map(([key, value]) => [key.trim(), String(value).trim()] as const)
    .filter(([key, value]) => key && value);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeTransport(raw: unknown): 'stdio' | 'http' {
  return String(raw ?? 'stdio').trim().toLowerCase() === 'http' ? 'http' : 'stdio';
}

function normalizePersistedServer(server: Partial<PersistedMcpServer> & Pick<PersistedMcpServer, 'name' | 'transport'>): PersistedMcpServer {
  return {
    name: server.name.trim(),
    transport: normalizeTransport(server.transport),
    command: server.command?.trim() || undefined,
    args: normalizeArgs(server.args),
    url: server.url?.trim() || undefined,
    env: normalizeEnv(server.env),
    enabled: server.enabled ?? true,
    lastPing: server.lastPing,
    lastPingMs: typeof server.lastPingMs === 'number' ? server.lastPingMs : undefined,
    connected: server.connected ?? false,
    connectedAt: server.connectedAt,
    tools: server.tools ?? [],
  };
}

function rowToServer(row: McpServerRow): PersistedMcpServer {
  return {
    name: row.name,
    transport: normalizeTransport(row.command ? 'stdio' : 'http'),
    command: row.command ?? undefined,
    args: Array.isArray(row.args) ? row.args.map(String).filter(Boolean) : [],
    url: row.url ?? undefined,
    env: normalizeEnv(row.env),
    enabled: row.enabled,
    lastPing: row.last_ping ?? undefined,
    lastPingMs: row.last_ping_ms ?? undefined,
    connected: false,
    connectedAt: undefined,
    tools: [],
  };
}

async function ensureDbReady(): Promise<boolean> {
  if (
    process.env.CARINA_MCP_STORE === 'file'
    || process.env.CARINA_SKIP_POSTGRES === 'true'
    || process.env.CARINA_LOCAL_MODE === 'true'
  ) {
    return false;
  }
  try {
    await initDb();
    return true;
  } catch {
    return false;
  }
}

async function readLegacyFile(): Promise<PersistedMcpServer[]> {
  try {
    const raw = await fs.readFile(legacyPath(), 'utf8');
    const parsed = JSON.parse(raw) as LegacyMcpFile;
    return (parsed.servers ?? []).map((server) => normalizePersistedServer({
      ...server,
      name: String(server.name ?? '').trim(),
      transport: normalizeTransport(server.transport),
    } as PersistedMcpServer)).filter((server) => server.name.length > 0);
  } catch {
    return [];
  }
}

async function writeLegacyFile(servers: PersistedMcpServer[]): Promise<void> {
  const file = legacyPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ servers }, null, 2), 'utf8');
}

async function loadFromDb(): Promise<PersistedMcpServer[] | null> {
  if (!(await ensureDbReady())) return null;
  try {
    const result = await pool.query<McpServerRow>(
      `SELECT id, name, url, command, args, env, enabled, last_ping, last_ping_ms, created_at
         FROM mcp_servers
        ORDER BY created_at ASC, name ASC`,
    );
    const rows = result.rows.map(rowToServer);
    if (rows.length === 0) {
      const legacy = await readLegacyFile();
      if (legacy.length > 0) {
        for (const server of legacy) {
          await upsertDbServer(server);
        }
        return loadFromDb();
      }
    }
    return rows;
  } catch {
    return null;
  }
}

async function upsertDbServer(server: PersistedMcpServer): Promise<PersistedMcpServer | null> {
  if (!(await ensureDbReady())) return null;
  const normalized = normalizePersistedServer(server);
  try {
    const result = await pool.query<McpServerRow>(
      `INSERT INTO mcp_servers (name, url, command, args, env, enabled, last_ping, last_ping_ms)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
       ON CONFLICT (name) DO UPDATE SET
         url = EXCLUDED.url,
         command = EXCLUDED.command,
         args = EXCLUDED.args,
         env = EXCLUDED.env,
         enabled = EXCLUDED.enabled,
         last_ping = EXCLUDED.last_ping,
         last_ping_ms = EXCLUDED.last_ping_ms
       RETURNING id, name, url, command, args, env, enabled, last_ping, last_ping_ms, created_at`,
      [
        normalized.name,
        normalized.url ?? null,
        normalized.command ?? null,
        JSON.stringify(normalized.args ?? []),
        JSON.stringify(normalized.env ?? {}),
        normalized.enabled,
        normalized.lastPing ?? null,
        normalized.lastPingMs ?? null,
      ],
    );
    return rowToServer(result.rows[0] as McpServerRow);
  } catch {
    return null;
  }
}

async function updateDbServer(name: string, patch: Partial<PersistedMcpServer>): Promise<PersistedMcpServer | null> {
  if (!(await ensureDbReady())) return null;
  const current = await getDbServer(name);
  if (!current) return null;
  const next = normalizePersistedServer({
    ...current,
    ...patch,
    name: String(patch.name ?? current.name).trim(),
    transport: normalizeTransport(patch.transport ?? current.transport),
  });
  if (next.name !== current.name) {
    const conflict = await getDbServer(next.name);
    if (conflict) {
      throw new Error(`MCP server already exists: ${next.name}`);
    }
  }
  try {
    const result = await pool.query<McpServerRow>(
      `UPDATE mcp_servers
          SET name = $2,
              url = $3,
              command = $4,
              args = $5::jsonb,
              env = $6::jsonb,
              enabled = $7,
              last_ping = $8,
              last_ping_ms = $9
        WHERE name = $1
       RETURNING id, name, url, command, args, env, enabled, last_ping, last_ping_ms, created_at`,
      [
        current.name,
        next.name,
        next.url ?? null,
        next.command ?? null,
        JSON.stringify(next.args ?? []),
        JSON.stringify(next.env ?? {}),
        next.enabled,
        next.lastPing ?? null,
        next.lastPingMs ?? null,
      ],
    );
    return rowToServer(result.rows[0] as McpServerRow);
  } catch {
    return null;
  }
}

async function getDbServer(name: string): Promise<PersistedMcpServer | null> {
  if (!(await ensureDbReady())) return null;
  try {
    const result = await pool.query<McpServerRow>(
      `SELECT id, name, url, command, args, env, enabled, last_ping, last_ping_ms, created_at
         FROM mcp_servers
        WHERE name = $1
        LIMIT 1`,
      [name],
    );
    return result.rows[0] ? rowToServer(result.rows[0] as McpServerRow) : null;
  } catch {
    return null;
  }
}

export async function listMcpServers(): Promise<PersistedMcpServer[]> {
  const fromDb = await loadFromDb();
  if (fromDb) return fromDb;
  return readLegacyFile();
}

export async function replaceMcpServers(servers: PersistedMcpServer[]): Promise<void> {
  const normalized = servers.map((server) => normalizePersistedServer(server));
  if (await ensureDbReady()) {
    await pool.query('DELETE FROM mcp_servers');
    for (const server of normalized) {
      await upsertDbServer(server);
    }
    return;
  }
  await writeLegacyFile(normalized);
}

export async function addMcpServer(config: Partial<PersistedMcpServer> & Pick<PersistedMcpServer, 'name' | 'transport'>): Promise<PersistedMcpServer> {
  const next = normalizePersistedServer({ ...config, enabled: config.enabled ?? true });
  const saved = await upsertDbServer(next);
  if (saved) return saved;
  const servers = await readLegacyFile();
  const idx = servers.findIndex((server) => server.name === next.name);
  if (idx >= 0) servers[idx] = next;
  else servers.push(next);
  await writeLegacyFile(servers);
  return next;
}

export async function updateMcpServer(id: string, patch: Partial<PersistedMcpServer>): Promise<PersistedMcpServer> {
  const updated = await updateDbServer(id, patch);
  if (updated) return updated;
  const servers = await readLegacyFile();
  const idx = servers.findIndex((server) => server.name === id);
  if (idx < 0) throw new Error('MCP server not found');
  const next = normalizePersistedServer({
    ...servers[idx],
    ...patch,
    name: String(patch.name ?? id).trim() || id,
    transport: normalizeTransport(patch.transport ?? servers[idx].transport),
  });
  servers.splice(idx, 1, next);
  await writeLegacyFile(servers);
  return next;
}

export async function removeMcpServer(id: string): Promise<boolean> {
  if (await ensureDbReady()) {
    try {
      const result = await pool.query('DELETE FROM mcp_servers WHERE name = $1', [id]);
      if (result.rowCount && result.rowCount > 0) return true;
    } catch {
      // fall back to file store
    }
  }
  const servers = await readLegacyFile();
  const next = servers.filter((server) => server.name !== id);
  if (next.length === servers.length) return false;
  await writeLegacyFile(next);
  return true;
}

export async function pingMcpServer(id: string): Promise<{ ok: boolean; ms: number }> {
  const server = await getDbServer(id) ?? (await readLegacyFile()).find((item) => item.name === id) ?? null;
  if (!server) {
    throw new Error('MCP server not found');
  }
  const startedAt = Date.now();
  try {
    if (server.transport === 'http') {
      const client = new McpHttpClient(server.name, server.url ?? '');
      try {
        await client.connect();
      } finally {
        await client.disconnect().catch(() => undefined);
      }
    } else {
      const client = new McpStdioClient(server.name, server.command ?? '', server.args ?? [], server.env ?? {});
      try {
        await client.connect();
      } finally {
        await client.disconnect().catch(() => undefined);
      }
    }
    const ms = Date.now() - startedAt;
    await updateMcpServer(id, { lastPing: new Date().toISOString(), lastPingMs: ms });
    return { ok: true, ms };
  } catch {
    const ms = Date.now() - startedAt;
    await updateMcpServer(id, { lastPing: new Date().toISOString(), lastPingMs: ms });
    return { ok: false, ms };
  }
}
