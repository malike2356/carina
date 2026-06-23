import type { IAgentAdapter } from './agent-adapter.interface.js';
import { carinaAdapter } from './adapters/carina-adapter.js';
import { externalAgentAdapter } from './adapters/external-agent-adapter.js';
import { genericAdapter } from './adapters/generic-adapter.js';
import { goalResultAdapter } from './adapters/goal-result-adapter.js';
import { langChainAdapter } from './adapters/langchain-adapter.js';
import { openAiAdapter } from './adapters/openai-adapter.js';

const adapters = new Map<string, IAgentAdapter>();

const LEGACY_AGENT_ALIASES: Record<string, string> = {
  hermes: 'compat-agent',
  openclaw: 'goal-result',
};

export function registerAdapter(adapter: IAgentAdapter): void {
  adapters.set(adapter.agentType.toLowerCase(), adapter);
}

export function resolveAdapter(agentType: string | undefined): IAgentAdapter {
  if (!agentType) return genericAdapter;
  const normalized = agentType.toLowerCase();
  const resolved = LEGACY_AGENT_ALIASES[normalized] ?? normalized;
  return adapters.get(resolved) ?? genericAdapter;
}

export function listAdapters(): IAgentAdapter[] {
  return [...adapters.values()];
}

export function resetAdapters(): void {
  adapters.clear();
  for (const adapter of [
    carinaAdapter,
    externalAgentAdapter,
    goalResultAdapter,
    openAiAdapter,
    langChainAdapter,
    genericAdapter,
  ]) {
    registerAdapter(adapter);
  }
}

resetAdapters();
