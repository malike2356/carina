export const MESSAGING_APPROVAL_CHANNEL_IDS = [
  'whatsapp',
  'telegram',
  'slack',
  'discord',
  'teams',
  'sms',
] as const;

export type MessagingApprovalChannelId = (typeof MESSAGING_APPROVAL_CHANNEL_IDS)[number];

export function isMessagingApprovalChannelId(
  channel: string,
): channel is MessagingApprovalChannelId {
  return (MESSAGING_APPROVAL_CHANNEL_IDS as readonly string[]).includes(channel);
}

export function messagingChannelLabel(channel: string): string {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'telegram':
      return 'Telegram';
    case 'slack':
      return 'Slack';
    case 'discord':
      return 'Discord';
    case 'teams':
      return 'Microsoft Teams';
    case 'sms':
      return 'SMS';
    case 'voice':
      return 'Phone';
    default:
      return channel;
  }
}
