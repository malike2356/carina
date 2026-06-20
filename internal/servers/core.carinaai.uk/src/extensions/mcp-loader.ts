import fs from 'fs/promises';
import path from 'path';
import type { McpServerConfig } from '../mcp/types.js';
import {
  connectServer,
  disconnectServer,
  listConnections,
} from '../mcp/registry.js';
import { extensionDir } from '../config/paths.js';
import { readExtensionManifest } from './validator.js';
import { extensionsRuntimeEnabled } from './contributions.js';

const serversByExtension = new Map<string, string[]>();

type McpManifest = {
  servers?: Record<string, Omit<McpServerConfig, 'name'> & { name?: string }>;
};

function parseMcpManifest(raw: unknown): McpManifest {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  if (rec.servers && typeof rec.servers === 'object') {
    return { servers: rec.servers as McpManifest['servers'] };
  }
  return { servers: rec as McpManifest['servers'] };
}

export function extensionMcpServerNames(id: string): string[] {
  return [...(serversByExtension.get(id) ?? [])];
}

export async function loadExtensionMcpServers(id: string): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;
  const bundleDir = extensionDir(id);
  const manifest = await readExtensionManifest(bundleDir);
  if (!manifest.capabilities.includes('mcp') || !manifest.entryPoints.mcp) return 0;

  const mcpPath = path.join(bundleDir, manifest.entryPoints.mcp);
  const raw = JSON.parse(await fs.readFile(mcpPath, 'utf-8')) as unknown;
  const parsed = parseMcpManifest(raw);
  const entries = Object.entries(parsed.servers ?? {});
  const connected: string[] = [];

  for (const [key, cfg] of entries) {
    const name = `ext_${id}_${cfg.name ?? key}`;
    const config: McpServerConfig = {
      name,
      transport: cfg.transport ?? 'stdio',
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
      url: cfg.url,
    };
    try {
      await connectServer(config);
      connected.push(name);
    } catch (err) {
      console.warn(`[extensions/mcp] ${id}/${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  serversByExtension.set(id, connected);
  return connected.length;
}

export async function unloadExtensionMcpServers(id: string): Promise<void> {
  const names = serversByExtension.get(id) ?? [];
  for (const name of names) {
    await disconnectServer(name).catch(() => undefined);
  }
  serversByExtension.delete(id);
}

export async function loadEnabledExtensionMcpServers(): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;
  const { listEnabledExtensionIds } = await import('./store.js');
  const ids = await listEnabledExtensionIds();
  let total = 0;
  for (const id of ids) {
    total += await loadExtensionMcpServers(id);
  }
  return total;
}

export function listExtensionMcpConnections(): ReturnType<typeof listConnections> {
  return listConnections().filter((c) => c.name.startsWith('ext_'));
}

export function listExtensionsWithMcp(): string[] {
  return [...serversByExtension.keys()];
}

export function resetExtensionMcpForTests(): void {
  serversByExtension.clear();
}
