import type { ChannelName } from './channel-adapter.interface.js';

export interface ChannelCapabilities {
  maxMessageLength: number;
  supportsEmbeds: boolean;
  supportsReactions: boolean;
  supportsThreading: boolean;
  supportsBlockKit: boolean;
  plainTextOnly: boolean;
}

export const CHANNEL_CAPABILITIES: Record<ChannelName, ChannelCapabilities> = {
  cli: {
    maxMessageLength: 100_000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  web: {
    maxMessageLength: 100_000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  telegram: {
    maxMessageLength: 4096,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  whatsapp: {
    maxMessageLength: 1600,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  discord: {
    maxMessageLength: 2000,
    supportsEmbeds: true,
    supportsReactions: true,
    supportsThreading: true,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  slack: {
    maxMessageLength: 3000,
    supportsEmbeds: false,
    supportsReactions: true,
    supportsThreading: true,
    supportsBlockKit: true,
    plainTextOnly: false,
  },
  sms: {
    maxMessageLength: 160,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  signal: {
    maxMessageLength: 2000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  matrix: {
    maxMessageLength: 4000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: true,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  mattermost: {
    maxMessageLength: 4000,
    supportsEmbeds: false,
    supportsReactions: true,
    supportsThreading: true,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  dingtalk: {
    maxMessageLength: 2000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  feishu: {
    maxMessageLength: 4000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: true,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  wechat: {
    maxMessageLength: 2000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  imessage: {
    maxMessageLength: 2000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  email: {
    maxMessageLength: 50_000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: true,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  homeassistant: {
    maxMessageLength: 4000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: true,
  },
  api: {
    maxMessageLength: 100_000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
  webhooks: {
    maxMessageLength: 100_000,
    supportsEmbeds: false,
    supportsReactions: false,
    supportsThreading: false,
    supportsBlockKit: false,
    plainTextOnly: false,
  },
};
