import {
  QUICK_CONNECT_CHANNELS,
  formatSetupTime,
  getQuickConnectChannel,
  quickConnectByTier,
} from '@/lib/channel-quick-connect';
import type { OnboardingChannelOption, OnboardingTemplateSummary } from '@/lib/onboarding-catalog';

export type OnboardingStartResponse = {
  templates: OnboardingTemplateSummary[];
  channels: Array<{
    id: string;
    name: string;
    iconName: string;
    tier: number;
    estimatedSeconds: number;
    setupTimeLabel: string;
    configurePath: string;
    setupInstructions: string[];
    channelType: string;
  }>;
  customTemplate: OnboardingTemplateSummary;
};

const LOCAL_CHANNEL_QUICK_START: Record<string, string> = {
  telegram: 'Create a bot with @BotFather, then paste the token on the channel page.',
  web: 'Enable web chat on your worker and copy the embed snippet.',
  email: 'Connect a mailbox or use your dedicated @mail.carinaai.uk address.',
  whatsapp: 'Use WhatsApp Web QR for fastest setup, or Business API for production scale.',
  slack: 'Install the Slack app and connect your workspace.',
};

export function getOnboardingChannelsFromLocal(): OnboardingChannelOption[] {
  return quickConnectByTier(false).map((channel, index, list) => ({
    channelId: channel.id,
    label: channel.name,
    iconName: channel.iconName,
    setupEase: list.length - index,
    configureHref: `/channels/${channel.id}`,
    quickStartHint: LOCAL_CHANNEL_QUICK_START[channel.id] ?? channel.name,
  }));
}

export function mapCatalogChannelsToOnboardingOptions(
  channels: OnboardingStartResponse['channels'],
): OnboardingChannelOption[] {
  return channels.map((channel, index, list) => ({
    channelId: channel.id,
    label: channel.name,
    iconName: channel.iconName,
    setupEase: list.length - index,
    configureHref: channel.configurePath,
    quickStartHint: channel.setupInstructions[0] ?? channel.name,
  }));
}

export async function fetchOnboardingStart(): Promise<OnboardingStartResponse | null> {
  try {
    const res = await fetch('/api/onboarding/start', { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<OnboardingStartResponse>;
  } catch {
    return null;
  }
}

export function getOnboardingChannels(): OnboardingChannelOption[] {
  return getOnboardingChannelsFromLocal();
}

export function resolveChannelSetupUrl(channelId: string | undefined, workerId?: string): string | null {
  if (!channelId) return null;
  const channel = getQuickConnectChannel(channelId);
  if (!channel) return null;
  if (workerId) {
    return `/aiva/workers/${workerId}/channels`;
  }
  return `/channels/${channel.id}`;
}

export { QUICK_CONNECT_CHANNELS, formatSetupTime, getQuickConnectChannel, quickConnectByTier };
