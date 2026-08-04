import type { AivaChannelName } from './types.js';
import { isSocialChannel } from './social-channel-utils.js';

/** Messaging channels that create approval drafts instead of auto-sending. */
export const MESSAGING_APPROVAL_CHANNEL_NAMES = [
  'whatsapp',
  'telegram',
  'slack',
  'discord',
  'teams',
  'sms',
] as const;

export type MessagingApprovalChannelName = (typeof MESSAGING_APPROVAL_CHANNEL_NAMES)[number];

export function isMessagingApprovalChannel(
  channel: string,
): channel is MessagingApprovalChannelName {
  return (MESSAGING_APPROVAL_CHANNEL_NAMES as readonly string[]).includes(channel);
}

/** Social DMs and messaging channels share the outbound approval inbox. Web stays live. */
export function isOutboundApprovalChannel(channel: AivaChannelName): boolean {
  return isSocialChannel(channel) || isMessagingApprovalChannel(channel);
}
