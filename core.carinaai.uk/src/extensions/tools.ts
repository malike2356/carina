import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { Tool } from '../types/index.js';
import { registry } from '../tools/registry.js';
import { extensionDir } from '../config/paths.js';
import { extensionsRuntimeEnabled } from './contributions.js';
import { listEnabledExtensionIds } from './store.js';
import { readExtensionManifest } from './validator.js';
import { resolveBuiltinToolFromJson } from './builtin-tools.js';

const registeredByExtension = new Map<string, Set<string>>();

export function extensionToolNames(id: string): string[] {
  return [...(registeredByExtension.get(id) ?? [])];
}

export function unregisterExtensionTools(id: string): void {
  const names = registeredByExtension.get(id);
  if (!names) return;
  for (const name of names) {
    registry.unregister(name);
  }
  registeredByExtension.delete(id);
}

type HttpToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  dangerous?: boolean;
  method?: string;
  url?: string;
  urlEnv?: string;
};

function toolFromHttpDefinition(def: HttpToolDefinition, prefix: string): Tool {
  const name = `${prefix}${def.name}`;
  return {
    name,
    description: def.description,
    parameters: def.parameters,
    dangerous: def.dangerous === true,
    execute: async (params) => {
      const url = def.urlEnv ? process.env[def.urlEnv] : def.url;
      if (!url) {
        return { error: `Tool ${name}: URL not configured${def.urlEnv ? ` (set ${def.urlEnv})` : ''}` };
      }
      const method = (def.method ?? 'POST').toUpperCase();
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(params),
      });
      const text = await res.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return { status: res.status, body: text.slice(0, 4000) };
      }
    },
  };
}

async function loadJsonTools(entryPath: string, prefix: string): Promise<Tool[]> {
  const raw = JSON.parse(await fs.readFile(entryPath, 'utf-8')) as unknown;
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { tools?: unknown }).tools)
      ? (raw as { tools: unknown[] }).tools
      : [];

  const out: Tool[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (rec.integration === 'builtin' || rec.builtin || rec.builtinTool) {
      const tool = resolveBuiltinToolFromJson(rec, prefix);
      if (tool) out.push(tool);
      continue;
    }
    if (rec.integration === 'http' || rec.url || rec.urlEnv) {
      out.push(toolFromHttpDefinition({
        name: String(rec.name),
        description: String(rec.description ?? ''),
        parameters: (rec.parameters as Record<string, unknown>) ?? { type: 'object', properties: {} },
        dangerous: rec.dangerous === true,
        method: rec.method ? String(rec.method) : undefined,
        url: rec.url ? String(rec.url) : undefined,
        urlEnv: rec.urlEnv ? String(rec.urlEnv) : undefined,
      }, prefix));
    }
  }
  return out;
}

async function loadModuleTools(entryPath: string, prefix: string): Promise<Tool[]> {
  const mod = await import(entryPath) as {
    default?: Tool | Tool[];
    tools?: Tool[];
  };
  const exported = mod.tools ?? mod.default;
  const list = Array.isArray(exported) ? exported : exported ? [exported] : [];
  return list.map((tool) => ({
    ...tool,
    name: tool.name.startsWith(prefix) ? tool.name : `${prefix}${tool.name}`,
  }));
}

export async function registerExtensionToolsFromBundle(id: string): Promise<number> {
  const bundleDir = extensionDir(id);
  const manifest = await readExtensionManifest(bundleDir);
  if (!manifest.capabilities.includes('tools') || !manifest.entryPoints.tools) {
    return 0;
  }

  const entryRel = manifest.entryPoints.tools;
  const entryPath = path.join(bundleDir, entryRel);
  const prefix = `ext_${id.replace(/-/g, '_')}_`;
  let tools: Tool[] = [];

  if (/\.json$/i.test(entryRel)) {
    tools = await loadJsonTools(entryPath, prefix);
  } else {
    tools = await loadModuleTools(pathToFileURL(entryPath).href, prefix);
  }

  const names = new Set<string>();
  for (const tool of tools) {
    if (!tool.name || !tool.description || typeof tool.execute !== 'function') continue;
    registry.register(tool);
    names.add(tool.name);
  }
  registeredByExtension.set(id, names);
  return names.size;
}

export async function registerEnabledExtensionTools(): Promise<number> {
  if (!extensionsRuntimeEnabled()) return 0;

  const ids = await listEnabledExtensionIds();
  let total = 0;
  for (const id of ids) {
    total += await registerExtensionToolsFromBundle(id);
  }
  return total;
}
