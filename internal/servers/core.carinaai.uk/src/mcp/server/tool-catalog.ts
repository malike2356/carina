import type { Tool } from '../../types/index.js';
import { registry } from '../../tools/registry.js';
import { resolveActiveToolNames } from '../../tools/toolset-config.js';
import { lookupToolRisk } from '../../tools/tool-risk-registry.js';

export function isToolExposedOnMcp(tool: Tool, allowDangerous: boolean): boolean {
  if (!allowDangerous) {
    if (tool.dangerous) return false;
    const risk = lookupToolRisk(tool.name);
    if (risk?.requiresDangerousFlag) return false;
  }
  return true;
}

export function resolveMcpToolNames(allowDangerous: boolean): string[] {
  const names = resolveActiveToolNames({ platform: 'mcp' });
  return names.filter((name) => {
    const tool = registry.get(name);
    if (!tool) return false;
    return isToolExposedOnMcp(tool, allowDangerous);
  });
}

export function listMcpTools(allowDangerous: boolean): Tool[] {
  return resolveMcpToolNames(allowDangerous)
    .map((name) => registry.get(name))
    .filter((tool): tool is Tool => tool !== undefined);
}

export function toMcpToolDefinition(tool: Tool): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
} {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
  };
}
