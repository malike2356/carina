import type { Tool } from '../types/index.js';
import { connectWorkerChannel, WorkerChannelConnectError } from '../channels/worker-channel-connect.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { registerSessionTool } from './session-tool-store.js';

function maskIdentifier(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function createAivaChannelSelfConfigTool(sessionId: string): Tool {
  return {
    name: 'aiva-channel-connect',
    description:
      'Connect this exact Aiva worker to a messaging channel using credentials the owner provides in chat. '
      + 'Use this when the user provides a Telegram BotFather token, asks you to connect Telegram, '
      + 'or says they want this Aiva to configure its own channel. '
      + 'This saves encrypted worker channel credentials, registers the Telegram webhook, and activates the channel. '
      + 'Never echo the bot token back to the user.',
    parameters: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          enum: ['telegram'],
          description: 'Channel to connect. Currently supported: telegram.',
        },
        bot_token: {
          type: 'string',
          description: 'Telegram BotFather bot token. Sensitive. Never repeat it in the final answer.',
        },
      },
      required: ['channel', 'bot_token'],
    },
    execute: async (params) => {
      const ctx = getWorkerSessionContext(sessionId);
      if (!ctx) {
        return {
          ok: false,
          error: 'No active Aiva worker session. Open the Aiva chat and try again.',
        };
      }

      const channel = String(params.channel ?? '').trim();
      if (channel !== 'telegram') {
        return {
          ok: false,
          error: 'Only Telegram self-configuration is available right now.',
        };
      }

      const botToken = String(params.bot_token ?? '').trim();
      try {
        const row = await connectWorkerChannel({
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          channel: 'telegram',
          credentials: { bot_token: botToken },
        });
        return {
          ok: true,
          channel: row.channel,
          workerId: row.workerId,
          identifier: maskIdentifier(row.identifier),
          active: row.enabled,
          verified: row.verified,
          message:
            'Telegram is connected for this Aiva. Open the bot in Telegram, send /start, then ask it to create documents, run research, or manage workspace tasks.',
        };
      } catch (err) {
        if (err instanceof WorkerChannelConnectError) {
          return {
            ok: false,
            error: err.message,
            code: err.code,
          };
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export function registerAivaChannelSelfConfigTool(sessionId: string): void {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return;
  registerSessionTool(sessionId, createAivaChannelSelfConfigTool(sessionId));
}
