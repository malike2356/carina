import type { SlashCommand } from './registry.js';
import type { InboundMessage } from '../types.js';
import {
  formatWorkerMemoryStatus,
  rememberForWorker,
  forgetForWorker,
  searchForWorker,
  clearAivaConversation,
  statusAivaConversation,
} from '../../memory/aiva/memory-commands.js';
import { describeExternalMemoryForStatus } from '../../memory/aiva/external-provider.js';

function argsAfterCommand(content: string): string {
  const parts = content.trim().split(/\s+/);
  return parts.slice(1).join(' ').trim();
}

export const memoryCommand: SlashCommand = {
  name: 'memory',
  description: 'Show bounded USER/MEMORY durable notes and budgets',
  async handler(msg: InboundMessage) {
    return formatWorkerMemoryStatus({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      contactId: msg.contactId,
    });
  },
};

export const rememberCommand: SlashCommand = {
  name: 'remember',
  description: 'Save a durable fact (user: or memory: prefix optional)',
  async handler(msg: InboundMessage) {
    try {
      const worker = await import('../../workers/worker-store.js').then((m) =>
        m.getWorkerById(msg.workerId),
      );
      if (worker?.workerConfig?.privacy?.incognito) {
        return 'Incognito is on. Turn it off with /incognito_off before saving durable memory.';
      }
      return await rememberForWorker({
        workspaceId: msg.workspaceId,
        workerId: msg.workerId,
        contactId: msg.contactId,
        text: argsAfterCommand(msg.content),
      });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const forgetCommand: SlashCommand = {
  name: 'forget',
  description: 'Remove a durable fact by id or unique text',
  async handler(msg: InboundMessage) {
    try {
      return await forgetForWorker({
        workspaceId: msg.workspaceId,
        workerId: msg.workerId,
        idOrText: argsAfterCommand(msg.content),
      });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const searchCommand: SlashCommand = {
  name: 'search',
  description: 'Search this worker\'s full conversation store',
  async handler(msg: InboundMessage) {
    try {
      return await searchForWorker({
        workspaceId: msg.workspaceId,
        workerId: msg.workerId,
        query: argsAfterCommand(msg.content),
      });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  },
};

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear current conversation context (keeps durable memory)',
  async handler(msg: InboundMessage) {
    return clearAivaConversation({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      channel: msg.channel,
      contactId: msg.contactId,
    });
  },
};

/** Replaces legacy /new that only cleared obsolete aiva_sessions tables. */
export const newCommand: SlashCommand = {
  name: 'new',
  description: 'Start a fresh conversation (clear episodic context)',
  async handler(msg: InboundMessage) {
    const { clearAivaConversation } = await import('../../memory/aiva/memory-commands.js');
    await clearAivaConversation({
      workspaceId: msg.workspaceId,
      workerId: msg.workerId,
      channel: msg.channel,
      contactId: msg.contactId,
    });
    return 'Fresh conversation started. Durable USER/MEMORY notes were kept.';
  },
};

export async function enrichStatusWithMemory(
  base: string,
  msg: InboundMessage,
): Promise<string> {
  const convo = await statusAivaConversation({
    workspaceId: msg.workspaceId,
    workerId: msg.workerId,
    channel: msg.channel,
    contactId: msg.contactId,
  }).catch(() => null);
  const lines = [
    base,
    '',
    convo
      ? `Episodic turns in this chat: ${convo.episodicTurns}`
      : 'Episodic turns: unavailable',
    describeExternalMemoryForStatus(),
  ];
  return lines.join('\n');
}
