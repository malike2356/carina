import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';

async function discordApi(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const token = config.discord.botToken;
  if (!token) return { error: 'DISCORD_BOT_TOKEN not set' };

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

export const discordAdminTool: Tool = {
  name: 'discord-admin',
  description: 'Discord server administration: list channels, members, roles, pin messages, manage threads.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list_channels', 'list_members', 'list_roles', 'pin_message', 'create_thread', 'delete_message'],
      },
      guild_id: { type: 'string' },
      channel_id: { type: 'string' },
      message_id: { type: 'string' },
      name: { type: 'string', description: 'Thread name for create_thread' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => ['delete_message', 'pin_message'].includes(String(params.action)),
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list_channels') {
      const guildId = String(params.guild_id ?? '').trim();
      if (!guildId) return { error: 'guild_id is required' };
      return discordApi(`/guilds/${guildId}/channels`);
    }

    if (action === 'list_members') {
      const guildId = String(params.guild_id ?? '').trim();
      if (!guildId) return { error: 'guild_id is required' };
      return discordApi(`/guilds/${guildId}/members?limit=100`);
    }

    if (action === 'list_roles') {
      const guildId = String(params.guild_id ?? '').trim();
      if (!guildId) return { error: 'guild_id is required' };
      return discordApi(`/guilds/${guildId}/roles`);
    }

    if (action === 'pin_message') {
      const channelId = String(params.channel_id ?? '').trim();
      const messageId = String(params.message_id ?? '').trim();
      if (!channelId || !messageId) return { error: 'channel_id and message_id are required' };
      return discordApi(`/channels/${channelId}/pins/${messageId}`, 'PUT');
    }

    if (action === 'create_thread') {
      const channelId = String(params.channel_id ?? '').trim();
      const name = String(params.name ?? '').trim();
      if (!channelId || !name) return { error: 'channel_id and name are required' };
      return discordApi(`/channels/${channelId}/threads`, 'POST', {
        name,
        auto_archive_duration: 1440,
        type: 11,
      });
    }

    if (action === 'delete_message') {
      const channelId = String(params.channel_id ?? '').trim();
      const messageId = String(params.message_id ?? '').trim();
      if (!channelId || !messageId) return { error: 'channel_id and message_id are required' };
      return discordApi(`/channels/${channelId}/messages/${messageId}`, 'DELETE');
    }

    return { error: `unknown action: ${action}` };
  },
};
