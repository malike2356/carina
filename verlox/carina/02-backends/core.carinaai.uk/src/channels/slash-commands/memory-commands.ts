import type { SlashCommand } from './registry.js';
import type { InboundMessage } from '../types.js';
import {
  formatWorkerMemoryStatus,
  rememberForWorker,
  forgetForWorker,
  searchForWorker,
  clearAivaConversation,
  statusAivaConversation,
  aivaSessionId,
} from '../../memory/aiva/memory-commands.js';
import { clearSession } from '../../memory/store.js';
import { forceImmediateInvalidation } from '../../brain/prompt-cache.js';
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
    const sessionId = aivaSessionId(msg.workerId, msg.channel, msg.contactId);
    await clearSession(sessionId);
    forceImmediateInvalidation(sessionId);
    const { clearSessionPolicyBlock } = await import('../../security/kill-switch-listener.js');
    clearSessionPolicyBlock(sessionId);
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
