import type { AivaChannelName } from '../channels/types.js';

export type ChannelFrictionTier = 1 | 2 | 3 | 4;

export type ChannelSetupType = 'inline' | 'oauth' | 'token' | 'manual';

export type QuickConnectChannel = {
  id: string;
  name: string;
  iconName: string;
  tier: ChannelFrictionTier;
  setupType: ChannelSetupType;
  setupSteps: number;
  estimatedSeconds: number;
  channelType: AivaChannelName;
  advanced: boolean;
  available: boolean;
  configurePath: string;
  setupInstructions: string[];
  oauthPaths?: string[];
  connectApiPath: string;
};

const CORE_PUBLIC_URL = (
  process.env.CARINA_PUBLIC_URL
  ?? process.env.CARINA_CORE_PUBLIC_URL
  ?? 'https://core.carinaai.uk'
).replace(/\/$/, '');

export const QUICK_CONNECT_CHANNELS: QuickConnectChannel[] = [
  {
    id: 'web',
    name: 'Web chat',
    iconName: 'Globe',
    tier: 1,
    setupType: 'inline',
    setupSteps: 1,
    estimatedSeconds: 5,
    channelType: 'web',
    advanced: false,
    available: true,
    configurePath: '/channels/web',
    setupInstructions: [
      'Click Enable on your worker Channels tab.',
      'Copy the embed snippet into your website.',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    iconName: 'Send',
    tier: 2,
    setupType: 'token',
    setupSteps: 2,
    estimatedSeconds: 30,
    channelType: 'telegram',
    advanced: false,
    available: true,
    configurePath: '/channels/telegram',
    setupInstructions: [
      'Open Telegram and message @BotFather.',
      'Send /newbot and follow the steps.',
      'Paste the bot token on the channel setup screen.',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    iconName: 'MessageCircle',
    tier: 3,
    setupType: 'oauth',
    setupSteps: 3,
    estimatedSeconds: 60,
    channelType: 'whatsapp',
    advanced: false,
    available: true,
    configurePath: '/channels/whatsapp',
    setupInstructions: [
      'Click Connect WhatsApp.',
      'Authorize with Meta Business.',
      'Select your WhatsApp number when prompted.',
    ],
    oauthPaths: ['/api/aiva/social/oauth/meta/auth-url'],
    connectApiPath: '/api/aiva/social/oauth/meta/connect',
  },
  {
    id: 'email',
    name: 'Email',
    iconName: 'Mail',
    tier: 3,
    setupType: 'oauth',
    setupSteps: 3,
    estimatedSeconds: 60,
    channelType: 'email',
    advanced: false,
    available: true,
    configurePath: '/channels/email',
    setupInstructions: [
      'Connect Gmail or Outlook with OAuth, or use your dedicated @mail.carinaai.uk address.',
      'Share the address with clients; replies send from the same inbox.',
    ],
    oauthPaths: [
      '/api/aiva/email/oauth/gmail/auth-url',
      '/api/aiva/email/oauth/outlook/auth-url',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'slack',
    name: 'Slack',
    iconName: 'Hash',
    tier: 3,
    setupType: 'oauth',
    setupSteps: 3,
    estimatedSeconds: 45,
    channelType: 'slack',
    advanced: false,
    available: true,
    configurePath: '/channels/slack',
    setupInstructions: [
      'Create a Slack app with chat:write and im scopes.',
      'Install the app to your workspace.',
      'Paste the bot token on the channel setup screen.',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'sms',
    name: 'SMS (Twilio)',
    iconName: 'Phone',
    tier: 4,
    setupType: 'manual',
    setupSteps: 4,
    estimatedSeconds: 180,
    channelType: 'sms',
    advanced: true,
    available: true,
    configurePath: '/channels/sms',
    setupInstructions: [
      'Create a Twilio account and phone number.',
      'Add Account SID, Auth Token, and the sending number.',
      'Save credentials on the channel setup screen.',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'discord',
    name: 'Discord',
    iconName: 'MessageSquare',
    tier: 4,
    setupType: 'manual',
    setupSteps: 3,
    estimatedSeconds: 120,
    channelType: 'discord',
    advanced: true,
    available: true,
    configurePath: '/channels/discord',
    setupInstructions: [
      'Create a Discord application and bot.',
      'Copy the bot token and application ID.',
      'Paste credentials on the channel setup screen.',
    ],
    connectApiPath: '/api/channels',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    iconName: 'Users',
    tier: 4,
    setupType: 'manual',
    setupSteps: 3,
    estimatedSeconds: 120,
    channelType: 'teams',
    advanced: true,
    available: true,
    configurePath: '/channels/teams',
    setupInstructions: [
      'Register an app in Azure Entra ID.',
      'Add Bot Framework messaging endpoint.',
      'Paste app credentials on the channel setup screen.',
    ],
    connectApiPath: '/api/channels',
  },
];

export function formatSetupTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function getQuickConnectChannel(id: string): QuickConnectChannel | undefined {
  const normalized = id === 'webchat' ? 'web' : id;
  return QUICK_CONNECT_CHANNELS.find((channel) => channel.id === normalized);
}

export function quickConnectByTier(options: { advanced?: boolean } = {}): QuickConnectChannel[] {
  const includeAdvanced = options.advanced ?? false;
  return QUICK_CONNECT_CHANNELS.filter((channel) => (
    channel.available && (includeAdvanced ? true : !channel.advanced)
  ));
}

export function getOnboardingChannels(): QuickConnectChannel[] {
  return quickConnectByTier({ advanced: false }).sort((a, b) => a.tier - b.tier || a.estimatedSeconds - b.estimatedSeconds);
}

export function serializeQuickConnectChannel(channel: QuickConnectChannel) {
  return {
    ...channel,
    setupTimeLabel: formatSetupTime(channel.estimatedSeconds),
    webhookBaseUrl: CORE_PUBLIC_URL,
  };
}

export function listQuickConnectCatalog(options: { advanced?: boolean } = {}) {
  const channels = quickConnectByTier(options).map(serializeQuickConnectChannel);
  return {
    count: channels.length,
    channels,
    quickConnect: channels.filter((channel) => !channel.advanced),
    advanced: channels.filter((channel) => channel.advanced),
  };
}

export type ConnectChannelConfig = Record<string, string>;

export function buildConnectChannelBody(input: {
  workerId: string;
  channelId: string;
  config?: ConnectChannelConfig;
}): { path: string; body: Record<string, unknown> } | null {
  const channel = getQuickConnectChannel(input.channelId);
  if (!channel) return null;

  if (channel.setupType === 'inline' && channel.channelType === 'web') {
    return {
      path: channel.connectApiPath,
      body: {
        workerId: input.workerId,
        channel: channel.channelType,
        identifier: 'web',
        credentials: {},
      },
    };
  }

  if (channel.setupType === 'token' || channel.setupType === 'manual') {
    return {
      path: channel.connectApiPath,
      body: {
        workerId: input.workerId,
        channel: channel.channelType,
        identifier: input.config?.identifier ?? 'default',
        credentials: input.config ?? {},
      },
    };
  }

  return {
    path: channel.connectApiPath,
    body: {
      workerId: input.workerId,
      channel: channel.channelType,
      ...(input.config ?? {}),
    },
  };
}

export function resolveChannelSetupUrl(channelId: string, workerId?: string): string | null {
  const channel = getQuickConnectChannel(channelId);
  if (!channel) return null;
  if (workerId) {
    return `/aiva/workers/${workerId}/channels`;
  }
  return channel.configurePath;
}
