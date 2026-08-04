import {
  findChannelByAlias,
  listChannelSummaries,
  CHANNEL_REQUIREMENTS,
  getRequiredFields,
} from '../channels/channel-requirements.js';
import {
  getConfiguredChannels,
  saveChannelConfiguration,
  removeChannelConfiguration,
  testChannelConfiguration,
} from '../api/channel-config-api.js';

function resolveWorkspaceId(): string | null {
  return process.env.CARINA_WORKSPACE_ID?.trim() || null;
}

export const channelConfigTool = {
  name: 'channel_config',
  description: `Manage messaging and mail channel connections.
Actions: list | requirements | configure | test | remove.
Use when the user wants to connect, configure, check, or remove a channel
(Telegram, Slack, email/SMTP, WhatsApp, Discord, SMS, etc.).
Never tell the user to dig through dashboard pages for these tasks.
Prefer requirements first to learn the next field, then configure with collected credentials.
For list: returns current status of all channels.
For test: verifies connectivity for a saved channel.
For remove: deletes the saved channel configuration.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'requirements', 'configure', 'test', 'remove'],
        description: 'What to do',
      },
      channel_id: {
        type: 'string',
        description: 'Channel id or alias (e.g. "telegram", "tg", "email", "smtp", "slack")',
      },
      credentials: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Credential fields as defined by the channel requirements registry',
      },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>) {
    const action = String(params.action ?? '');
    const rawChannelId = String(params.channel_id ?? '').trim();
    const credentials = (params.credentials ?? {}) as Record<string, string>;
    const workspaceId = resolveWorkspaceId();

    if (action === 'list') {
      const configured = await getConfiguredChannels(workspaceId);
      const configuredMap = new Map(configured.map((c) => [c.channelId, c]));

      const channels = listChannelSummaries().map(({ id, name, aliases }) => {
        const conf = configuredMap.get(id);
        return {
          id,
          name,
          aliases,
          configured: Boolean(conf),
          status: conf?.status ?? 'not_configured',
          requiresRestart: conf?.requiresRestart ?? false,
          testedAt: conf?.testedAt ?? null,
        };
      });

      const connected = channels.filter((c) => c.configured);
      const notConnected = channels.filter((c) => !c.configured);

      return {
        action: 'list',
        summary: `${connected.length} channel${connected.length === 1 ? '' : 's'} configured, ${notConnected.length} available to set up.`,
        channels,
      };
    }

    if (action === 'requirements') {
      if (!rawChannelId) {
        return {
          action: 'requirements',
          error: 'channel_id is required. Available: ' + listChannelSummaries().map((c) => c.id).join(', '),
        };
      }
      const channel = findChannelByAlias(rawChannelId)
        ?? CHANNEL_REQUIREMENTS.find((c) => c.id === rawChannelId)
        ?? null;
      if (!channel) {
        return {
          action: 'requirements',
          error: `Unknown channel: "${rawChannelId}".`,
        };
      }
      const required = getRequiredFields(channel.id);
      const next = required[0] ?? channel.fields[0] ?? null;
      return {
        action: 'requirements',
        channelId: channel.id,
        name: channel.name,
        description: channel.description,
        setupDocs: channel.setupDocs,
        requiredFields: required.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          sensitive: f.sensitive,
          example: f.example,
        })),
        optionalFields: channel.fields.filter((f) => f.optional).map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          sensitive: f.sensitive,
          example: f.example,
        })),
        nextField: next
          ? {
              key: next.key,
              label: next.label,
              description: next.description,
              sensitive: next.sensitive,
              ask: next.sensitive
                ? `I need your ${next.label} next. If you prefer, type this one.`
                : `Please send your ${next.label}.`,
            }
          : null,
        hint: 'Ask for nextField only, then call configure with all collected credentials.',
      };
    }

    if (action === 'configure') {
      if (!rawChannelId) {
        return {
          action: 'configure',
          error: 'channel_id is required for configure. Available channels: '
            + listChannelSummaries().map((c) => c.id).join(', '),
        };
      }

      const channel = findChannelByAlias(rawChannelId)
        ?? CHANNEL_REQUIREMENTS.find((c) => c.id === rawChannelId)
        ?? null;

      if (!channel) {
        return {
          action: 'configure',
          error: `Unknown channel: "${rawChannelId}". Available: ${listChannelSummaries().map((c) => c.id).join(', ')}`,
        };
      }

      if (Object.keys(credentials).length === 0) {
        const required = getRequiredFields(channel.id);
        const optional = channel.fields.filter((f) => f.optional);
        return {
          action: 'configure',
          channelId: channel.id,
          name: channel.name,
          status: 'needs_credentials',
          requiredFields: required.map((f) => ({
            key: f.key,
            label: f.label,
            description: f.description,
            sensitive: f.sensitive,
            example: f.example,
          })),
          optionalFields: optional.map((f) => ({
            key: f.key,
            label: f.label,
            description: f.description,
            sensitive: f.sensitive,
            example: f.example,
          })),
          message: `To configure ${channel.name}, please provide the required fields.`,
          setupDocs: channel.setupDocs,
        };
      }

      const missingRequired = channel.fields
        .filter((f) => !f.optional && !credentials[f.key]?.trim())
        .map((f) => ({ key: f.key, label: f.label, sensitive: f.sensitive }));

      if (missingRequired.length > 0) {
        return {
          action: 'configure',
          channelId: channel.id,
          name: channel.name,
          status: 'missing_fields',
          missingFields: missingRequired,
          message: `Still need: ${missingRequired.map((f) => f.label).join(', ')}`,
        };
      }

      const result = await saveChannelConfiguration(channel, credentials, workspaceId);

      if (!result.ok) {
        return {
          action: 'configure',
          channelId: channel.id,
          name: channel.name,
          success: false,
          error: result.error ?? 'Failed to save configuration.',
        };
      }

      return {
        action: 'configure',
        channelId: channel.id,
        name: channel.name,
        success: true,
        requiresRestart: result.requiresRestart,
        message: result.requiresRestart
          ? `${channel.name} is configured. Restart Carina for it to become active.`
          : `${channel.name} is configured and active.`,
      };
    }

    if (action === 'test') {
      if (!rawChannelId) {
        return { action: 'test', error: 'channel_id is required for test.' };
      }

      const channel = findChannelByAlias(rawChannelId)
        ?? CHANNEL_REQUIREMENTS.find((c) => c.id === rawChannelId)
        ?? null;
      const channelId = channel?.id ?? rawChannelId;

      const result = await testChannelConfiguration(channelId, workspaceId);
      return { action: 'test', channelId, ...result };
    }

    if (action === 'remove') {
      if (!rawChannelId) {
        return { action: 'remove', error: 'channel_id is required for remove.' };
      }

      const channel = findChannelByAlias(rawChannelId)
        ?? CHANNEL_REQUIREMENTS.find((c) => c.id === rawChannelId)
        ?? null;
      const channelId = channel?.id ?? rawChannelId;

      const result = await removeChannelConfiguration(channelId, workspaceId);
      return {
        action: 'remove',
        channelId,
        success: result.ok,
        message: result.ok
          ? `${channel?.name ?? channelId} configuration removed.`
          : 'Could not remove configuration.',
      };
    }

    return { error: `Unknown action: "${action}". Use list, configure, test, or remove.` };
  },
};
