import type { IAgentAdapter } from '../agent-adapter.interface.js';
import { carinaAdapter } from './carina-adapter.js';
import { genericAdapter } from './generic-adapter.js';
import { hermesAdapter } from './hermes-adapter.js';
import { langChainAdapter } from './langchain-adapter.js';
import { openAiAdapter } from './openai-adapter.js';
import { openClawAdapter } from './openclaw-adapter.js';

const adapters = new Map<string, IAgentAdapter>();

export function registerAdapter(adapter: IAgentAdapter): void {
  adapters.set(adapter.agentType.toLowerCase(), adapter);
}

export function resolveAdapter(agentType: string | undefined): IAgentAdapter {
  if (!agentType) return genericAdapter;
  return adapters.get(agentType.toLowerCase()) ?? genericAdapter;
}

export function listAdapters(): IAgentAdapter[] {
  return [...adapters.values()];
}

export function resetAdapters(): void {
  adapters.clear();
  for (const adapter of [carinaAdapter, hermesAdapter, openClawAdapter, openAiAdapter, langChainAdapter, genericAdapter]) {
    registerAdapter(adapter);
  }
}

resetAdapters();
