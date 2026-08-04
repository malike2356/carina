export const SOCIAL_CHANNEL_IDS = [
  'linkedin',
  'instagram',
  'messenger',
  'twitter',
  'tiktok',
] as const;

export type SocialChannelId = (typeof SOCIAL_CHANNEL_IDS)[number];

export type SocialConnectionStatus =
  | 'disconnected'
  | 'oauth_pending'
  | 'connected'
  | 'token_expired';

export function isSocialChannelId(channel: string): channel is SocialChannelId {
  return (SOCIAL_CHANNEL_IDS as readonly string[]).includes(channel);
}

export function socialChannelLabel(channel: string): string {
  switch (channel) {
    case 'linkedin':
      return 'LinkedIn';
    case 'instagram':
      return 'Instagram';
    case 'messenger':
      return 'Facebook Messenger';
    case 'twitter':
      return 'X (Twitter)';
    case 'tiktok':
      return 'TikTok';
    default:
      return channel;
  }
}

export function socialOAuthProvider(channel: string): 'linkedin' | 'meta' | 'twitter' | 'tiktok' | null {
  switch (channel) {
    case 'linkedin':
      return 'linkedin';
    case 'instagram':
    case 'messenger':
      return 'meta';
    case 'twitter':
      return 'twitter';
    case 'tiktok':
      return 'tiktok';
    default:
      return null;
  }
}

export function socialInboundWebhookUrl(workerId: string, channel: string): string {
  const base = (process.env.NEXT_PUBLIC_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
  return `${base}/api/aiva/channels/inbound/${channel}/${workerId}`;
}

export function socialConnectionStatusLabel(status: SocialConnectionStatus | undefined): string {
  switch (status) {
    case 'oauth_pending':
      return 'OAuth pending';
    case 'connected':
      return 'Connected';
    case 'token_expired':
      return 'Token expired';
    default:
      return 'Disconnected';
  }
}

export function isSocialPresenceHireTemplate(templateId: string | null): boolean {
  return templateId === 'social-media-manager';
}

export function hireIncludesSocialChannels(channels: readonly string[]): boolean {
  return channels.some((channel) => isSocialChannelId(channel));
}
