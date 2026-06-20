import type { Tool } from '../types/index.js';
import {
  deferPromptInvalidation,
  getFrozenSystemPrompt,
} from '../brain/prompt-cache.js';

const store = new Map<string, Map<string, Tool>>();

export function registerSessionTool(sessionId: string, tool: Tool): { deferred: boolean } {
  let session = store.get(sessionId);
  if (!session) {
    session = new Map();
    store.set(sessionId, session);
  }
  session.set(tool.name, tool);
  if (getFrozenSystemPrompt(sessionId)) {
    deferPromptInvalidation(sessionId, `tool registered: ${tool.name}`);
    return { deferred: true };
  }
  return { deferred: false };
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
