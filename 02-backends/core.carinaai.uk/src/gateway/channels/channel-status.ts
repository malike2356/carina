import type { ChannelName } from './channel-adapter.interface.js';
import { buildCatalogChannelSpecs, isCatalogStubChannel } from './catalog-channel-specs.js';
import { shouldExposeChannel } from './stub-channels.js';
import { channelRegistry } from './channel-registry.js';
import { isBaileysConfigured } from '../baileys/whatsapp-baileys.js';
import { isSmsConfigured } from '../sms.js';
import { config } from '../../config/index.js';

export type ChannelHealthState =
  | 'connected'
  | 'configured'
  | 'partial'
  | 'disabled'
  | 'unsupported'
  | 'error';

export type ChannelStatusReport = {
  channel: ChannelName;
  state: ChannelHealthState;
  active: boolean;
  transport?: string;
  reason?: string;
  webhook?: string;
  env: string[];
};

type ChannelSpec = {
  channel: ChannelName;
  env: string[];
  note: string;
  webhook?: string;
  checkConfigured: () => boolean;
  checkConnected?: () => boolean;
  transport?: () => string;
};

function hasEnv(keys: string[]): boolean {
  return keys.every((k) => {
    if (k.includes('=')) {
      const [name, value] = k.split('=');
      return process.env[name!] === value;
    }
    return Boolean(process.env[k]?.trim());
  });
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((k) => {
    if (k.includes('=')) {
      const [name, value] = k.split('=');
      return process.env[name!] === value;
    }
    return Boolean(process.env[k]?.trim());
  });
}

const SPECS: ChannelSpec[] = [
  {
    channel: 'telegram',
    env: ['TELEGRAM_BOT_TOKEN'],
    note: 'Native long-polling bot',
    checkConfigured: () => hasEnv(['TELEGRAM_BOT_TOKEN']),
    checkConnected: () => channelRegistry.getByName('telegram')?.enabled ?? false,
    transport: () => 'long-poll',
  },
  {
    channel: 'discord',
    env: ['DISCORD_BOT_TOKEN'],
    note: 'Discord gateway bot',
    checkConfigured: () => hasEnv(['DISCORD_BOT_TOKEN']),
    checkConnected: () => channelRegistry.getByName('discord')?.enabled ?? false,
    transport: () => 'gateway',
  },
  {
    channel: 'slack',
    env: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'],
    note: 'Slack socket mode',
    checkConfigured: () => hasEnv(['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']),
    checkConnected: () => channelRegistry.getByName('slack')?.enabled ?? false,
    transport: () => 'socket-mode',
  },
  {
    channel: 'whatsapp',
    env: ['BAILEYS_WHATSAPP_ENABLED=true', 'or TWILIO_*'],
    note: 'Baileys live bridge or Twilio webhook',
    checkConfigured: () => isBaileysConfigured() || Boolean(config.twilio.accountSid && config.twilio.authToken),
    checkConnected: () => channelRegistry.getByName('whatsapp')?.enabled ?? false,
    transport: () => {
      if (isBaileysConfigured()) return 'baileys-bridge';
      if (config.twilio.accountSid) return 'twilio-webhook';
      return 'none';
    },
  },
  {
    channel: 'signal',
    env: ['SIGNAL_API_URL', 'SIGNAL_API_KEY', 'SIGNAL_PHONE_NUMBER'],
    note: 'signal-cli-rest-api sidecar',
    webhook: '/webhooks/signal',
    checkConfigured: () => hasEnv(['SIGNAL_API_URL', 'SIGNAL_PHONE_NUMBER']),
    checkConnected: () => channelRegistry.getByName('signal')?.enabled ?? false,
    transport: () => 'webhook+poll',
  },
  {
    channel: 'imessage',
    env: ['BLUEBUBBLES_URL', 'BLUEBUBBLES_PASSWORD'],
    note: 'BlueBubbles macOS bridge (operator-controlled)',
    webhook: '/webhooks/imessage',
    checkConfigured: () => hasAnyEnv(['BLUEBUBBLES_URL', 'IMESSAGE_API_URL']),
    checkConnected: () => channelRegistry.getByName('imessage')?.enabled ?? false,
    transport: () => 'bluebubbles',
  },
  {
    channel: 'matrix',
    env: ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN', 'MATRIX_USER_ID'],
    note: 'Matrix bot (/sync or webhook)',
    webhook: '/webhooks/matrix',
    checkConfigured: () => hasEnv(['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN']),
    checkConnected: () => channelRegistry.getByName('matrix')?.enabled ?? false,
    transport: () => (process.env.MATRIX_SYNC_ENABLED === 'false' ? 'webhook-only' : 'sync'),
  },
  {
    channel: 'mattermost',
    env: ['MATTERMOST_URL', 'MATTERMOST_TOKEN'],
    note: 'Mattermost outgoing webhook + bot token',
    webhook: '/webhooks/mattermost',
    checkConfigured: () => hasEnv(['MATTERMOST_URL', 'MATTERMOST_TOKEN']),
    checkConnected: () => channelRegistry.getByName('mattermost')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'sms',
    env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'],
    note: 'Twilio SMS',
    webhook: '/webhooks/sms',
    checkConfigured: () => isSmsConfigured(),
    checkConnected: () => channelRegistry.getByName('sms')?.enabled ?? false,
    transport: () => 'twilio',
  },
  {
    channel: 'web',
    env: ['WEB_ENABLED=true'],
    note: 'Browser chat UI',
    checkConfigured: () => process.env.WEB_ENABLED !== 'false',
    checkConnected: () => channelRegistry.getByName('web')?.enabled ?? false,
  },
  {
    channel: 'cli',
    env: ['(default)'],
    note: 'Terminal REPL',
    checkConfigured: () => true,
    checkConnected: () => true,
  },
  {
    channel: 'dingtalk',
    env: ['DINGTALK_WEBHOOK_URL or DINGTALK_APP_KEY'],
    note: 'DingTalk bot webhook',
    webhook: '/webhooks/dingtalk',
    checkConfigured: () => hasAnyEnv(['DINGTALK_WEBHOOK_URL', 'DINGTALK_APP_KEY']),
    checkConnected: () => channelRegistry.getByName('dingtalk')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'feishu',
    env: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'],
    note: 'Feishu/Lark bot',
    webhook: '/webhooks/feishu',
    checkConfigured: () => hasEnv(['FEISHU_APP_ID', 'FEISHU_APP_SECRET']),
    checkConnected: () => channelRegistry.getByName('feishu')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'wechat',
    env: ['WECHAT_CORP_ID or WECHAT_WEBHOOK_URL'],
    note: 'WeCom (WeChat Work)',
    webhook: '/webhooks/wechat',
    checkConfigured: () => hasAnyEnv(['WECHAT_WEBHOOK_URL', 'WECHAT_CORP_ID']),
    checkConnected: () => channelRegistry.getByName('wechat')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'email',
    env: ['EMAIL_CHANNEL_ENABLED=true'],
    note: 'Inbound email webhook',
    webhook: '/webhooks/email',
    checkConfigured: () => process.env.EMAIL_CHANNEL_ENABLED === 'true',
    checkConnected: () => channelRegistry.getByName('email')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'homeassistant',
    env: ['HA_CHANNEL_ENABLED=true or HOMEASSISTANT_URL'],
    note: 'Home Assistant automation channel',
    webhook: '/webhooks/homeassistant',
    checkConfigured: () => process.env.HA_CHANNEL_ENABLED === 'true'
      || hasEnv(['HOMEASSISTANT_URL', 'HOMEASSISTANT_TOKEN']),
    checkConnected: () => channelRegistry.getByName('homeassistant')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'api',
    env: ['API_CHANNEL_ENABLED=true or API_CHANNEL_API_KEY'],
    note: 'HTTP API channel',
    webhook: '/webhooks/api/message',
    checkConfigured: () => process.env.API_CHANNEL_ENABLED === 'true'
      || Boolean(process.env.API_CHANNEL_API_KEY || process.env.CARINA_API_KEY),
    checkConnected: () => channelRegistry.getByName('api')?.enabled ?? false,
    transport: () => 'http-api',
  },
  {
    channel: 'webhooks',
    env: ['WEBHOOK_CHANNEL_ENABLED=true'],
    note: 'Generic callback webhook channel',
    webhook: '/webhooks/webhooks',
    checkConfigured: () => process.env.WEBHOOK_CHANNEL_ENABLED === 'true',
    checkConnected: () => channelRegistry.getByName('webhooks')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'line',
    env: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'],
    note: 'LINE Messaging API bot',
    webhook: '/webhooks/line',
    checkConfigured: () => hasEnv(['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN']),
    checkConnected: () => channelRegistry.getByName('line')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'viber',
    env: ['VIBER_AUTH_TOKEN'],
    note: 'Viber Public Account bot',
    webhook: '/webhooks/viber',
    checkConfigured: () => hasEnv(['VIBER_AUTH_TOKEN']),
    checkConnected: () => channelRegistry.getByName('viber')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'google-chat',
    env: ['GOOGLE_CHAT_VERIFICATION_TOKEN'],
    note: 'Google Chat app webhook',
    webhook: '/webhooks/google-chat',
    checkConfigured: () => hasEnv(['GOOGLE_CHAT_VERIFICATION_TOKEN']),
    checkConnected: () => channelRegistry.getByName('google-chat')?.enabled ?? false,
    transport: () => 'webhook',
  },
  {
    channel: 'teams',
    env: ['TEAMS_APP_ID', 'TEAMS_APP_PASSWORD'],
    note: 'Microsoft Teams Bot Framework',
    webhook: '/webhooks/teams',
    checkConfigured: () => hasEnv(['TEAMS_APP_ID', 'TEAMS_APP_PASSWORD']),
    checkConnected: () => channelRegistry.getByName('teams')?.enabled ?? false,
    transport: () => 'webhook',
  },
  ...buildCatalogChannelSpecs(),
];

export function whatsappBridgeMode(): 'baileys' | 'twilio' | 'none' {
  if (isBaileysConfigured()) return 'baileys';
  if (config.twilio.accountSid && config.twilio.authToken) return 'twilio';
  return 'none';
}

export function whatsappSelfBridgeEnabled(): boolean {
  return process.env.CARINA_WHATSAPP_SELF_BRIDGE === 'true';
}

function resolveState(spec: ChannelSpec): ChannelHealthState {
  if (isCatalogStubChannel(spec.channel)) {
    if (!spec.checkConfigured()) return 'unsupported';
    return 'partial';
  }
  const configured = spec.checkConfigured();
  const active = channelRegistry.getByName(spec.channel as ChannelName)?.enabled ?? false;
  const connected = spec.checkConnected?.() ?? active;

  if (!configured) return 'disabled';
  if (active && connected) return 'connected';
  if (configured && !active) return 'partial';
  if (configured) return 'configured';
  return 'disabled';
}

export function getChannelStatusReports(): ChannelStatusReport[] {
  return SPECS.filter((spec) => shouldExposeChannel(spec.channel)).map((spec) => {
    const state = resolveState(spec);
    const active = isCatalogStubChannel(spec.channel)
      ? false
      : (channelRegistry.getByName(spec.channel as ChannelName)?.enabled ?? false);
    let reason: string | undefined;
    if (state === 'disabled') reason = `Missing env: ${spec.env.join(', ')}`;
    if (state === 'partial' && !isCatalogStubChannel(spec.channel)) {
      reason = 'Configured but adapter not active (start gateway or check credentials)';
    }
    if (isCatalogStubChannel(spec.channel) && state === 'unsupported') {
      reason = `${spec.channel} webhook contract only; configure env to enable inbound stub`;
    }
    if (isCatalogStubChannel(spec.channel) && state === 'partial') {
      reason = `Webhook stub: POST JSON to ${spec.webhook ?? `/webhooks/${spec.channel}`}; outbound via send-message`;
    }
    if (spec.channel === 'whatsapp' && isBaileysConfigured()) {
      reason = [
        reason,
        whatsappSelfBridgeEnabled() ? 'self-bridge ON (fromMe allowed for own JID)' : 'self-bridge off',
      ].filter(Boolean).join('; ');
    }
    return {
      channel: spec.channel,
      state,
      active,
      transport: spec.transport?.(),
      reason,
      webhook: spec.webhook,
      env: spec.env,
    };
  });
}

export function getChannelStatus(channel: ChannelName): ChannelStatusReport | undefined {
  return getChannelStatusReports().find((r) => r.channel === channel);
}

export function getChannelPolicyFlags(): Record<string, boolean> {
  return {
    threadOwnership: process.env.CARINA_THREAD_OWNERSHIP === 'true',
    dmPairing: process.env.CARINA_CHANNEL_DM_PAIRING === 'true',
    peerScoping: process.env.CARINA_CHANNEL_PEER_SCOPING === 'true',
    whatsappSelfBridge: whatsappSelfBridgeEnabled(),
    whatsappGroups: process.env.CARINA_WHATSAPP_GROUPS === 'true',
  };
}
