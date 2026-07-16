import type { AivaChannelName } from './types.js';

export const SOCIAL_CHANNEL_NAMES = [
  'linkedin',
  'instagram',
  'messenger',
  'twitter',
  'tiktok',
] as const;

export type SocialChannelName = (typeof SOCIAL_CHANNEL_NAMES)[number];

export function isSocialChannel(channel: string): channel is SocialChannelName {
  return (SOCIAL_CHANNEL_NAMES as readonly string[]).includes(channel);
}

export function isSocialAivaChannel(channel: AivaChannelName): channel is SocialChannelName {
  return isSocialChannel(channel);
}

export function socialCredentialsComplete(
  channel: SocialChannelName,
  credentials: Record<string, string>,
): boolean {
  switch (channel) {
    case 'linkedin':
      return Boolean(credentials.access_token?.trim() && credentials.member_id?.trim());
    case 'instagram':
      return Boolean(
        credentials.page_access_token?.trim()
        && credentials.instagram_business_account_id?.trim(),
      );
    case 'messenger':
      return Boolean(credentials.page_access_token?.trim() && credentials.page_id?.trim());
    case 'twitter':
      return Boolean(
        credentials.access_token?.trim()
        && credentials.access_token_secret?.trim()
        && credentials.user_id?.trim(),
      );
    case 'tiktok':
      return Boolean(credentials.access_token?.trim() && credentials.open_id?.trim());
    default:
      return false;
  }
}

export function isSocialChannelConnected(
  channel: AivaChannelName,
  row: { identifier: string; credentials: { encrypted?: string } } | undefined,
): boolean {
  if (!row?.credentials.encrypted) return false;
  if (row.identifier === 'pending') return false;
  return true;
}
