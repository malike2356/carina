import type { SlashCommand } from './registry.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';
import { getRouter } from '../../router.js';
import { resolveInboundAgentRoute } from '../../../workspaces/index.js';
import {
  formatCoreMemoryStatus,
  rememberForCore,
  forgetForCore,
} from '../../../memory/aiva/memory-commands.js';
import { searchSessionsAdvanced } from '../../../memory/session-search-service.js';
import { describeExternalMemoryForStatus } from '../../../memory/aiva/external-provider.js';

function argsAfterCommand(content: string): string {
  const parts = content.trim().split(/\s+/);
  return parts.slice(1).join(' ').trim();
}

function messageText(msg: ChannelMessage): string {
  return msg.text ?? '';
}

export const memoryCommand: SlashCommand = {
  name: 'memory',
  description: 'Show bounded USER/MEMORY durable notes and budgets',
  handler: async () => formatCoreMemoryStatus(),
};

export const rememberCommand: SlashCommand = {
  name: 'remember',
  description: 'Save a durable fact (user: or memory: prefix optional)',
  handler: async (msg) => {
    try {
      return await rememberForCore(argsAfterCommand(messageText(msg)));
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const forgetCommand: SlashCommand = {
  name: 'forget',
  description: 'Remove a durable fact by id or unique text',
  handler: async (msg) => {
    try {
      return await forgetForCore(argsAfterCommand(messageText(msg)));
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const searchCommand: SlashCommand = {
  name: 'search',
  description: 'Search past conversation sessions',
  handler: async (msg) => {
    const query = argsAfterCommand(messageText(msg));
    if (!query) return 'Usage: /search <query>';
    try {
      const result = await searchSessionsAdvanced({ query, limit: 8 });
      if (!result.results.length) return `No conversation matches for "${query}".`;
      return [
        `Search results for "${query}":`,
        ...result.results.map((hit, i) => `${i + 1}. [${hit.sessionId}] ${hit.snippet || hit.title}`),
      ].join('\n');
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear current conversation context (keeps durable memory)',
  handler: async (msg: ChannelMessage) => {
    const route = await resolveInboundAgentRoute(msg);
    const router = getRouter();
    const sessionId = await router.getChannelSession(route.agent.id, msg);
    await router.clearSession(sessionId);
    return 'Conversation context cleared. Durable USER/MEMORY notes were kept.';
  },
};

export async function appendMemoryToStatus(base: string): Promise<string> {
  return `${base}\n${describeExternalMemoryForStatus()}`;
}
