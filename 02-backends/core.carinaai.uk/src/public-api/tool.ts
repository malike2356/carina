// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

import { registry } from '../tools/registry.js';
import type { Tool, ToolCall, ToolResult } from '../types/index.js';

export type { Tool, ToolCall, ToolResult };
export type ToolDefinition = Tool;

/** Register a tool on the global kernel registry. */
export function registerTool(tool: Tool): void {
  registry.register(tool);
}

/** Remove a tool from the global kernel registry. */
export function unregisterTool(name: string): boolean {
  return registry.unregister(name);
}

export { ToolRegistry } from '../tools/registry.js';

export const TOOL_API_VERSION = '0.2.0';
