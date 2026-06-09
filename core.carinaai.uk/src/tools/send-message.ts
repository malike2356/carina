import type { Tool } from '../types/index.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { channelRegistry } from '../gateway/channels/channel-registry.js';

const OUTBOUND_CHANNELS: ChannelName[] = [
  'telegram', 'discord', 'slack', 'sms', 'whatsapp',
  'signal', 'matrix', 'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
];

export const sendMessageTool: Tool = {
  name: 'send-message',
  description:
    'Send a text message to a user on an enabled messaging channel. Supports telegram, discord, slack, sms, whatsapp, signal, matrix, mattermost, dingtalk, feishu, wechat, imessage, and email.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        enum: OUTBOUND_CHANNELS,
        description: 'Target messaging platform',
      },
      conversation_id: {
        type: 'string',
        description: 'Channel-specific conversation or chat ID',
      },
      text: { type: 'string', description: 'Message text to send' },
      thread_id: { type: 'string', description: 'Optional thread ID (Discord, Slack)' },
    },
    required: ['channel', 'conversation_id', 'text'],
  },
  requiresConfirmation: true,
  execute: async (params) => {
    const channel = String(params.channel ?? '').toLowerCase() as ChannelName;
    const conversationId = String(params.conversation_id ?? '').trim();
    const text = String(params.text ?? '').trim();
    const threadId = params.thread_id ? String(params.thread_id) : undefined;

    if (!text) return { error: 'text is required' };
    if (!conversationId) return { error: 'conversation_id is required' };
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
  },
};
