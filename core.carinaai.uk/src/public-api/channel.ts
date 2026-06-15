// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

export type {
  IChannelAdapter as ChannelAdapter,
  ChannelName,
  ChannelMessage,
  SendOptions,
  Attachment,
  WebhookValidationInput,
} from '../gateway/channels/channel-adapter.interface.js';

export const CHANNEL_API_VERSION = '0.2.0';
