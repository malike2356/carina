import { redactToolParams } from '../../security/redaction.js';
import { t } from '../../i18n/index.js';
import type { ChannelName, SendOptions } from './channel-adapter.interface.js';
import { formatForChannel } from './channel-formatter.js';

export type ChannelApprovalPrompt = {
  toolName: string;
  reason: string;
  paramsSummary?: string;
};

export type ChannelApprovalPayload = {
  text: string;
  options: SendOptions;
};

const INTERACTIVE_CHANNELS = new Set<ChannelName>(['slack', 'discord', 'telegram']);

export function channelSupportsInteractiveApproval(channel: ChannelName): boolean {
  return INTERACTIVE_CHANNELS.has(channel);
}

export function channelApprovalUiEnabled(): boolean {
  if (process.env.CARINA_CHANNEL_APPROVAL_UI === 'false') return false;
  return process.env.CARINA_CHANNEL_APPROVAL_UI === 'true'
    || process.env.CARINA_CHANNEL_APPROVAL_UI !== 'off';
}

export function summarizeToolParamsForChannel(params: Record<string, unknown>): string {
  const redacted = redactToolParams(params);
  const keys = Object.keys(redacted).filter((k) => !k.startsWith('_'));
  if (keys.length === 0) return '';
  const preview = keys.slice(0, 4).map((k) => `${k}=${String(redacted[k]).slice(0, 80)}`).join(', ');
  return keys.length > 4 ? `${preview}, ...` : preview;
}

export function buildChannelApprovalPayload(
  channel: ChannelName,
  prompt: ChannelApprovalPrompt,
): ChannelApprovalPayload {
  const summary = prompt.paramsSummary ? `\n${prompt.paramsSummary}` : '';

  switch (channel) {
    case 'slack':
      return buildSlackApproval(prompt, summary);
    case 'discord':
      return buildDiscordApproval(prompt, summary);
    case 'telegram':
      return buildTelegramApproval(prompt, summary);
    default:
      return {
        text: formatForChannel(
          channel,
          `${t('gateway.approval.required', { tool: prompt.toolName })}: ${prompt.reason}${summary}`,
        )[0],
        options: {},
      };
  }
}

function buildSlackApproval(prompt: ChannelApprovalPrompt, summary: string): ChannelApprovalPayload {
  const text = `Carina needs approval to run \`${prompt.toolName}\``;
  return {
    text,
    options: {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${prompt.toolName}*\n${prompt.reason}${summary}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Approve' },
              style: 'primary',
              action_id: 'carina_approve',
              value: prompt.toolName,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Deny' },
              style: 'danger',
              action_id: 'carina_deny',
              value: prompt.toolName,
            },
          ],
        },
      ],
    },
  };
}

function buildDiscordApproval(prompt: ChannelApprovalPrompt, summary: string): ChannelApprovalPayload {
  return {
    text: `Approval required: ${prompt.toolName}`,
    options: {
      embeds: [
        {
          title: `Approve ${prompt.toolName}?`,
          description: `${prompt.reason}${summary}`.trim(),
          color: 0xf59e0b,
        },
      ],
    },
  };
}

function buildTelegramApproval(prompt: ChannelApprovalPrompt, summary: string): ChannelApprovalPayload {
  const text = formatForChannel('telegram', `*Approval required*\nTool: ${prompt.toolName}\n${prompt.reason}${summary}`)[0];
  return {
    text,
    options: {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: 'Approve', callback_data: `carina:approve:${prompt.toolName}` },
            { text: 'Deny', callback_data: `carina:deny:${prompt.toolName}` },
          ],
        ],
      },
    },
  };
}
