import type { Tool } from '../types/index.js';
import { registry } from './registry.js';
import { listSessionTools } from './session-tool-store.js';
import { resolveActiveToolNames } from './toolset-config.js';
import { ALWAYS_ON_TOOLS, filterLeafTools } from './toolset.js';
import { isSubagentSession } from '../agents/delegation-context.js';

export type SessionToolResolution = {
  names: string[];
  tools: Tool[];
  isSubagent: boolean;
  toolsets: string[];
};

export function resolveSessionToolNames(opts: {
  sessionId: string;
  platform?: string;
  explicitAllowed?: string[];
}): string[] {
  const isSubagent = isSubagentSession(opts.sessionId);
  let names = resolveActiveToolNames({
    platform: opts.platform,
    explicitAllowed: opts.explicitAllowed,
  });

  if (isSubagent || opts.explicitAllowed?.length) {
    names = isSubagent ? filterLeafTools(names) : names;
  } else {
    const allowed = new Set([...names, ...ALWAYS_ON_TOOLS]);
    names = [...allowed];
  }

  return names;
}

export function resolveSessionTools(opts: {
  sessionId: string;
  platform?: string;
  explicitAllowed?: string[];
}): SessionToolResolution {
  const names = resolveSessionToolNames(opts);
  const allowed = new Set(names);
  const globalTools = registry.list().filter((t) => allowed.has(t.name));
  const sessionTools = listSessionTools(opts.sessionId).filter((t) => allowed.has(t.name));
  const byName = new Map(globalTools.map((t) => [t.name, t]));
  for (const tool of sessionTools) byName.set(tool.name, tool);

  const toolsets = registry.toolsetsForNames([...byName.keys()]);

  return {
    names: [...byName.keys()].sort(),
    tools: [...byName.values()],
    isSubagent: isSubagentSession(opts.sessionId),
    toolsets,
  };
}
