import type { Tool } from '../types/index.js';

const store = new Map<string, Map<string, Tool>>();

export function registerSessionTool(sessionId: string, tool: Tool): void {
  let session = store.get(sessionId);
  if (!session) {
    session = new Map();
    store.set(sessionId, session);
  }
  session.set(tool.name, tool);
}

export function getSessionTool(sessionId: string, toolName: string): Tool | undefined {
  return store.get(sessionId)?.get(toolName);
}

export function listSessionTools(sessionId: string): Tool[] {
  return [...(store.get(sessionId)?.values() ?? [])];
}

export function clearSessionTools(sessionId: string): void {
  store.delete(sessionId);
}
