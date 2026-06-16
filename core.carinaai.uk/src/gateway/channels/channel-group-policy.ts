import { config } from '../../config/index.js';
import type { ChannelMessage, ChannelName } from './channel-adapter.interface.js';

export type GroupInboundDecision = {
  accept: boolean;
  reason: string;
};

const MENTION_GATED_CHANNELS = new Set<ChannelName>([
  'discord',
  'slack',
  'telegram',
  'whatsapp',
  'matrix',
  'irc',
  'webex',
  'rocketchat',
  'groupme',
  'mattermost',
  'twitch',
]);

export function groupMentionRequired(channel: ChannelName): boolean {
  if (process.env.CARINA_GROUP_OPEN === 'true') return false;
  if (channel === 'irc') return process.env.IRC_MENTION_ONLY !== 'false';
  return MENTION_GATED_CHANNELS.has(channel);
}

export function isChannelAllowlisted(inbound: ChannelMessage): boolean {
  if (inbound.channel === 'discord') {
    return config.discord.allowedChannelIds.includes(inbound.conversationId);
  }
  if (inbound.channel === 'slack') {
    return config.slack.allowedChannelIds.includes(inbound.conversationId);
  }
  return false;
}

/**
 * Mention-gated group behavior: accept DMs, commands, mentions, and allowlisted rooms.
 * Adapters should still set isMention/isCommand accurately; this is the shared gate.
 */
export function shouldAcceptGroupInbound(inbound: ChannelMessage): GroupInboundDecision {
  if (inbound.isDirect) {
    return { accept: true, reason: 'direct message' };
  }

  if (!groupMentionRequired(inbound.channel)) {
    return { accept: true, reason: 'channel does not require mentions in groups' };
  }

  if (inbound.isCommand) {
    return { accept: true, reason: 'slash command' };
  }

  if (inbound.isMention) {
    return { accept: true, reason: 'bot mentioned' };
  }

  if (isChannelAllowlisted(inbound)) {
    return { accept: true, reason: 'allowlisted channel' };
  }

  return { accept: false, reason: 'group message without mention or command' };
}
