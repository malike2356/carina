import type { Tool } from '../types/index.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { channelRegistry } from '../gateway/channels/channel-registry.js';
import { findContact } from '../profiles/contacts.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { parseTelegramRecipient } from '../channels/recipient-parse.js';

const OUTBOUND_CHANNELS: ChannelName[] = [
  'telegram', 'discord', 'slack', 'sms', 'whatsapp',
  'signal', 'matrix', 'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
  'line', 'viber', 'google-chat', 'teams',
  'homeassistant', 'api', 'webhooks',
];

async function sendViaWorkerTelegram(opts: {
  workerId: string;
  recipient: string;
  text: string;
}): Promise<{ sent: true; channel: 'telegram'; conversation_id: string } | { error: string }> {
  const { listWorkerChannelDetails, readChannelCredentials } = await import('../channels/channel-store.js');
  const { getAdapter } = await import('../channels/adapter-registry.js');
  const channels = await listWorkerChannelDetails(opts.workerId);
  const row = channels.find((c) => c.channel === 'telegram' && c.enabled);
  if (!row) {
    return {
      error:
        'This Aiva has no Telegram channel connected. Connect Telegram for this worker under Channels, '
        + 'then ask the recipient to message the bot once so outbound DMs are allowed.',
    };
  }
  const credentials = readChannelCredentials(row);
  const botToken = credentials.bot_token ?? credentials.token;
  if (!botToken) {
    return { error: 'Telegram bot token is missing on this worker channel.' };
  }
  const adapter = getAdapter('telegram');
  if (!adapter) {
    return { error: 'Telegram worker adapter is not registered.' };
  }
  const chatId = parseTelegramRecipient(opts.recipient) ?? opts.recipient.trim();
  try {
    await adapter.send(
      { channel: 'telegram', contactId: chatId, content: opts.text },
      credentials,
    );
    return { sent: true, channel: 'telegram', conversation_id: chatId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/chat not found|can't initiate|bot was blocked|forbidden/i.test(msg)) {
      return {
        error:
          `Telegram could not message ${chatId}: ${msg}. `
          + 'Ask them to open the worker bot and tap Start once, then retry. '
          + 'Meanwhile use email if you have an address.',
      };
    }
    return { error: `Telegram send failed: ${msg}` };
  }
}

async function rememberTelegramHandle(contactName: string, handle: string, workspaceId?: string): Promise<void> {
  const matches = await findContact(contactName, workspaceId);
  const contact = matches[0];
  if (!contact) return;
  try {
    const { enrichContactChannels } = await import('../profiles/contacts.js');
    await enrichContactChannels(contact.id, { telegram: handle }, workspaceId);
  } catch {
    // best-effort memory of handle
  }
}

export const sendMessageTool: Tool = {
  name: 'send-message',
  dangerous: true,
  description:
    'Send a text message on any enabled channel. '
    + 'For Aiva workers, Telegram uses the worker bot token (not the global gateway). '
    + 'Telegram recipients: numeric chat id OR @username OR web.telegram.org / t.me links. '
    + 'Contact resolution: pass contact_name to look up Contacts. '
    + 'Channel preference when contacting a person: Telegram (@username) if known, else WhatsApp/phone, else email. '
    + 'If one channel fails, try the next. Returns { sent: true, channel, conversation_id } on success.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        enum: OUTBOUND_CHANNELS,
        description: 'Target messaging platform',
      },
      contact_name: {
        type: 'string',
        description: 'Contact name to resolve (searches synced Contacts directory)',
      },
      conversation_id: {
        type: 'string',
        description:
          'Channel conversation id. Telegram: numeric chat id, @username, or telegram.org/t.me link.',
      },
      text: { type: 'string', description: 'Message text to send' },
      thread_id: { type: 'string', description: 'Optional thread ID (Discord, Slack)' },
    },
    required: ['text'],
  },
  requiresConfirmation: true,
  execute: async (params) => {
    try {
      let channel = String(params.channel ?? '').toLowerCase() as ChannelName;
      let conversationId = String(params.conversation_id ?? '').trim();
      const text = String(params.text ?? '').trim();
      const threadId = params.thread_id ? String(params.thread_id) : undefined;
      const contactName = String(params.contact_name ?? '').trim();
      const sessionId = String(params._sessionId ?? '').trim();
      const workerCtx = sessionId ? getWorkerSessionContext(sessionId) : undefined;

      if (!text) return { error: 'text is required' };

      // Bare Telegram links / @handles in conversation_id without channel.
      const telegramFromId = parseTelegramRecipient(conversationId);
      if (!channel && telegramFromId) {
        channel = 'telegram';
        conversationId = telegramFromId;
      }

      if (contactName) {
        const workspaceId = workerCtx?.worker?.workspaceId;
        const matches = await findContact(contactName, workspaceId);
        if (matches.length === 0) return { error: `contact not found: ${contactName}` };
        const c = matches[0];
        if (!channel) {
          if (c.telegram) channel = 'telegram';
          else if (c.whatsapp || c.phone) channel = 'whatsapp';
          else if (c.email) channel = 'email';
          else return { error: `contact ${c.name} has no messaging channel configured` };
        }
        if (!conversationId) {
          if (channel === 'whatsapp' && (c.whatsapp || c.phone)) {
            conversationId = `${(c.whatsapp || c.phone || '').replace(/\D/g, '')}@s.whatsapp.net`;
          } else if (channel === 'telegram' && c.telegram) {
            conversationId = parseTelegramRecipient(c.telegram) ?? c.telegram;
          } else if (channel === 'email' && c.email) {
            conversationId = c.email;
          } else {
            return { error: `contact ${c.name} has no ${channel} address` };
          }
        }
      }

      if (!channel) return { error: 'channel or contact_name is required' };
      if (!conversationId) return { error: 'conversation_id is required (or use contact_name)' };
      if (!OUTBOUND_CHANNELS.includes(channel)) {
        return { error: `unsupported channel: ${channel}` };
      }

      if (channel === 'telegram') {
        const handle = parseTelegramRecipient(conversationId) ?? conversationId;
        if (contactName && handle.startsWith('@')) {
          void rememberTelegramHandle(contactName, handle, workerCtx?.worker?.workspaceId);
        }
        if (workerCtx?.worker?.id) {
          return sendViaWorkerTelegram({
            workerId: workerCtx.worker.id,
            recipient: handle,
            text,
          });
        }
      }

      const adapter = channelRegistry.getByName(channel);
      if (!adapter) {
        if (channel === 'telegram') {
          return {
            error:
              'Global Telegram gateway adapter is not loaded. '
              + 'For Aiva, ensure this worker has a Telegram bot connected under Channels.',
          };
        }
        return { error: `channel adapter not loaded: ${channel}` };
      }
      if (!adapter.enabled) {
        return { error: `channel not enabled or configured: ${channel}` };
      }

      try {
        await adapter.sendMessage(conversationId, text, { threadId });
        return { sent: true, channel, conversation_id: conversationId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `send failed: ${msg}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};
