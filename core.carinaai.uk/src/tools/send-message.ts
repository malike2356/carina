import type { Tool } from '../types/index.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { channelRegistry } from '../gateway/channels/channel-registry.js';
import { findContact } from '../profiles/contacts.js';

const OUTBOUND_CHANNELS: ChannelName[] = [
  'telegram', 'discord', 'slack', 'sms', 'whatsapp',
  'signal', 'matrix', 'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
  'line', 'viber', 'google-chat', 'teams',
  'homeassistant', 'api', 'webhooks',
];

export const sendMessageTool: Tool = {
  name: 'send-message',
  dangerous: true,
  description:
    'Send a text message on any enabled channel. Supported channels: telegram, discord, slack, sms, whatsapp, signal, matrix, mattermost, dingtalk, feishu, wechat, imessage, email, line, viber, google-chat, teams, homeassistant, api, webhooks. Contact resolution: pass contact_name to look up the contact from contacts.json and auto-select whatsapp, telegram, or email. If both contact_name and channel are given, that channel is used for lookup. Direct mode: pass channel + conversation_id explicitly (Telegram: numeric chat ID, WhatsApp: number@s.whatsapp.net, email: address). Returns { sent: true, channel, conversation_id } on success.',
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
        description: 'Contact name to resolve (searches Carina contacts.json and profiles)',
      },
      conversation_id: {
        type: 'string',
        description: 'Channel-specific conversation or chat ID (optional if contact_name set)',
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

      if (!text) return { error: 'text is required' };

      if (contactName) {
        const matches = await findContact(contactName);
        if (matches.length === 0) return { error: `contact not found: ${contactName}` };
        const c = matches[0];
        if (!channel) {
          if (c.whatsapp) channel = 'whatsapp';
          else if (c.telegram) channel = 'telegram';
          else if (c.email) channel = 'email';
          else return { error: `contact ${c.name} has no messaging channel configured` };
        }
        if (!conversationId) {
          if (channel === 'whatsapp' && c.whatsapp) conversationId = `${c.whatsapp.replace(/\D/g, '')}@s.whatsapp.net`;
          else if (channel === 'telegram' && c.telegram) conversationId = c.telegram;
          else if (channel === 'email' && c.email) conversationId = c.email;
          else return { error: `contact ${c.name} has no ${channel} address` };
        }
      }

      if (!channel) return { error: 'channel or contact_name is required' };
      if (!conversationId) return { error: 'conversation_id is required (or use contact_name)' };
      if (!OUTBOUND_CHANNELS.includes(channel)) {
        return { error: `unsupported channel: ${channel}` };
      }

      const adapter = channelRegistry.getByName(channel);
      if (!adapter) {
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
