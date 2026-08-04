import path from 'node:path';
import { resolveCarinaHome } from '../config/paths.js';
import {
  addMcpServer,
  listMcpServers,
  removeMcpServer as removeMcpServerFromStore,
  replaceMcpServers,
  updateMcpServer,
  type PersistedMcpServer,
} from '../tools/mcp-store.js';

export type { PersistedMcpServer } from '../tools/mcp-store.js';

export interface McpServersFile {
  servers: PersistedMcpServer[];
}

export function mcpConfigPath(): string {
  return path.join(resolveCarinaHome(), 'mcp', 'servers.json');
}

export async function readMcpServers(): Promise<PersistedMcpServer[]> {
  return listMcpServers();
}

export async function writeMcpServers(servers: PersistedMcpServer[]): Promise<void> {
  await replaceMcpServers(servers);
}

export async function upsertMcpServer(server: PersistedMcpServer): Promise<void> {
  const next = {
    ...server,
    enabled: server.enabled ?? true,
  } satisfies PersistedMcpServer;
  const existing = await readMcpServers();
  const has = existing.some((item) => item.name === next.name);
  if (has) {
    await updateMcpServer(next.name, next);
  } else {
    await addMcpServer(next);
  }
}

export async function removeMcpServer(name: string): Promise<boolean> {
  return removeMcpServerFromStore(name);
}

export async function markMcpServerPing(name: string, ms: number, tools: string[] = []): Promise<void> {
  await updateMcpServer(name, {
    lastPing: new Date().toISOString(),
    lastPingMs: ms,
    tools,
    connected: true,
    connectedAt: new Date().toISOString(),
  });
}
