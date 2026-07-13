export type ChannelFrictionTier = 1 | 2 | 3 | 4;

export type ChannelSetupType = 'inline' | 'oauth' | 'token' | 'manual';

export interface QuickConnectChannel {
  id: string;
  name: string;
  iconName: string;
  tier: ChannelFrictionTier;
  setupType: ChannelSetupType;
  setupSteps: number;
  estimatedSeconds: number;
  aivaChannelType: string;
  advanced?: boolean;
}

export const QUICK_CONNECT_CHANNELS: QuickConnectChannel[] = [
  {
    id: 'web',
    name: 'Web chat',
    iconName: 'Globe',
    tier: 1,
    setupType: 'inline',
    setupSteps: 1,
    estimatedSeconds: 5,
    aivaChannelType: 'web',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    iconName: 'Send',
    tier: 2,
    setupType: 'token',
    setupSteps: 2,
    estimatedSeconds: 30,
    aivaChannelType: 'telegram',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Web',
    iconName: 'MessageCircle',
    tier: 2,
    setupType: 'inline',
    setupSteps: 2,
    estimatedSeconds: 60,
    aivaChannelType: 'whatsapp',
  },
  {
    id: 'whatsapp_business_api',
    name: 'WhatsApp Business API',
    iconName: 'MessageCircle',
    tier: 4,
    setupType: 'manual',
    setupSteps: 4,
    estimatedSeconds: 240,
    aivaChannelType: 'whatsapp',
    advanced: true,
  },
  {
    id: 'email',
    name: 'Email',
    iconName: 'Mail',
    tier: 3,
    setupType: 'oauth',
    setupSteps: 3,
    estimatedSeconds: 60,
    aivaChannelType: 'email',
  },
  {
    id: 'slack',
    name: 'Slack',
    iconName: 'Hash',
    tier: 3,
    setupType: 'oauth',
    setupSteps: 3,
    estimatedSeconds: 45,
    aivaChannelType: 'slack',
  },
  {
    id: 'sms',
    name: 'SMS (Twilio)',
    iconName: 'Phone',
    tier: 4,
    setupType: 'manual',
    setupSteps: 4,
    estimatedSeconds: 180,
    aivaChannelType: 'sms',
    advanced: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    iconName: 'MessageSquare',
    tier: 4,
    setupType: 'manual',
    setupSteps: 3,
    estimatedSeconds: 120,
    aivaChannelType: 'discord',
    advanced: true,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    iconName: 'Users',
    tier: 4,
    setupType: 'manual',
    setupSteps: 3,
    estimatedSeconds: 120,
    aivaChannelType: 'teams',
    advanced: true,
  },
];

export function quickConnectByTier(advanced = false): QuickConnectChannel[] {
  return QUICK_CONNECT_CHANNELS.filter((ch) => (advanced ? ch.advanced : !ch.advanced));
}

export function getQuickConnectChannel(id: string): QuickConnectChannel | undefined {
  return QUICK_CONNECT_CHANNELS.find((ch) => ch.id === id);
}

export function formatSetupTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
