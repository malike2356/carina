import type { Tool } from '../types/index.js';
import { TOOLSET_MAP } from './toolset.js';
import { getCompactToolDescription } from './tool-descriptions.js';

type ProviderName = 'anthropic' | 'openai';

export type ToolSurface =
  | 'agent'
  | 'cli'
  | 'web'
  | 'mcp'
  | 'cron'
  | 'subagent'
  | 'playwright'
  | 'ops'
  | 'pack'
  | 'platform';

export type ToolRegistrationMeta = {
  toolset?: string;
  surfaces?: ToolSurface[];
  compactDescription?: string;
};

const TOOLSET_BY_NAME = new Map<string, string>();
for (const [set, tools] of Object.entries(TOOLSET_MAP)) {
  for (const tool of tools) {
    if (!TOOLSET_BY_NAME.has(tool)) TOOLSET_BY_NAME.set(tool, set);
  }
}

export function inferToolset(toolName: string): string | undefined {
  return TOOLSET_BY_NAME.get(toolName);
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  private meta = new Map<string, ToolRegistrationMeta>();

  register(tool: Tool, registration?: ToolRegistrationMeta): void {
    this.tools.set(tool.name, tool);
    this.meta.set(tool.name, {
      toolset: registration?.toolset ?? inferToolset(tool.name),
      surfaces: registration?.surfaces ?? ['agent'],
      compactDescription: registration?.compactDescription
        ?? getCompactToolDescription(tool.name, tool.description),
    });
  }

  unregister(name: string): boolean {
    this.meta.delete(name);
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getMeta(name: string): ToolRegistrationMeta | undefined {
    return this.meta.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  listByToolset(toolset: string): Tool[] {
    const key = toolset.toLowerCase().trim();
    return this.list().filter((tool) => this.meta.get(tool.name)?.toolset === key);
  }

  listToolsets(): string[] {
    const sets = new Set<string>();
    for (const m of this.meta.values()) {
      if (m.toolset) sets.add(m.toolset);
    }
    return [...sets].sort();
  }

  toolsetsForNames(names: string[]): string[] {
    const sets = new Set<string>();
    for (const name of names) {
      const set = this.meta.get(name)?.toolset ?? inferToolset(name);
      if (set) sets.add(set);
    }
    return [...sets].sort();
  }

  discover(opts?: { toolsets?: string[]; names?: string[] }): Tool[] {
    let tools = this.list();
    if (opts?.names?.length) {
      const allow = new Set(opts.names);
      tools = tools.filter((t) => allow.has(t.name));
    }
    if (opts?.toolsets?.length) {
      const allowSets = new Set(opts.toolsets.map((s) => s.toLowerCase().trim()));
      tools = tools.filter((t) => {
        const set = this.meta.get(t.name)?.toolset ?? inferToolset(t.name);
        return set != null && allowSets.has(set);
      });
    }
    return tools;
  }

  toProviderFormat(provider: ProviderName, tools?: Tool[]): unknown[] {
    const list = tools ?? this.list();
    return list.map((tool) => {
      if (provider === 'anthropic') {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        };
      }
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      };
    });
  }
}

export const registry = new ToolRegistry();
