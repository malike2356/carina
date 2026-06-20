import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import type { McpServerConfig } from './types.js';

export interface PersistedMcpServer extends McpServerConfig {
  connected?: boolean;
  connectedAt?: string;
  tools?: string[];
}

export interface McpServersFile {
  servers: PersistedMcpServer[];
}

export function mcpConfigPath(): string {
  return path.join(resolveCarinaHome(), 'mcp', 'servers.json');
}

export async function readMcpServers(): Promise<PersistedMcpServer[]> {
  try {
    const raw = await fs.readFile(mcpConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as McpServersFile;
    return parsed.servers ?? [];
  } catch {
    return [];
  }
}

export async function writeMcpServers(servers: PersistedMcpServer[]): Promise<void> {
  const file = mcpConfigPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ servers }, null, 2), 'utf8');
}

export async function upsertMcpServer(server: PersistedMcpServer): Promise<void> {
  const servers = await readMcpServers();
  const idx = servers.findIndex((s) => s.name === server.name);
  if (idx >= 0) servers[idx] = server;
  else servers.push(server);
  await writeMcpServers(servers);
}

export async function removeMcpServer(name: string): Promise<boolean> {
  const servers = await readMcpServers();
  const next = servers.filter((s) => s.name !== name);
  if (next.length === servers.length) return false;
  await writeMcpServers(next);
  return true;
}
