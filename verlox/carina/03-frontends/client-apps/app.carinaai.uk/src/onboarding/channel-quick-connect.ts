import {
  QUICK_CONNECT_CHANNELS,
  formatSetupTime,
  getQuickConnectChannel,
  quickConnectByTier,
  type ChannelFrictionTier,
  type ChannelSetupType,
  type QuickConnectChannel,
} from '@/lib/channel-quick-connect';

export type {
  ChannelFrictionTier,
  ChannelSetupType,
  QuickConnectChannel,
};

export {
  QUICK_CONNECT_CHANNELS,
  formatSetupTime,
  getQuickConnectChannel,
  quickConnectByTier,
};

export type QuickConnectCatalogResponse = {
  count: number;
  channels: Array<QuickConnectChannel & { setupTimeLabel: string; webhookBaseUrl: string }>;
  quickConnect: Array<QuickConnectChannel & { setupTimeLabel: string; webhookBaseUrl: string }>;
  advanced: Array<QuickConnectChannel & { setupTimeLabel: string; webhookBaseUrl: string }>;
};

export async function fetchQuickConnectCatalog(advanced = false): Promise<QuickConnectCatalogResponse | null> {
  try {
    const res = await fetch(`/api/onboarding/channels?advanced=${advanced ? 'true' : 'false'}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<QuickConnectCatalogResponse>;
  } catch {
    return null;
  }
}
