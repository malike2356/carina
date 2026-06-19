import type {
  ChannelMessage,
  ChannelName,
  IChannelAdapter,
} from './channel-adapter.interface.js';

export class ChannelRegistry {
  private adapters = new Map<ChannelName, IChannelAdapter>();
  private readonly order: ChannelName[] = [
    'telegram', 'whatsapp', 'web', 'discord', 'slack', 'sms',
    'signal', 'matrix', 'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
    'line', 'viber', 'google-chat', 'teams',
    'ntfy', 'pushover', 'gotify',
    'messenger', 'instagram', 'twitter', 'rocketchat', 'webex', 'kakaotalk', 'zalo',
    'threema', 'wire', 'keybase', 'twitch', 'youtube', 'groupme', 'nextcloud-talk', 'linkedin',
    'zulip', 'reddit', 'bluesky', 'skype', 'pumble', 'twist', 'ryver', 'workplace',
    'naver-works', 'qq', 'weibo', 'openhab', 'synology-chat', 'gitter', 'element',
    'mastodon', 'snapchat', 'bridge-generic', 'apple-business-chat',
    'homeassistant', 'api', 'webhooks', 'cli',
  ];

  register(adapter: IChannelAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getByName(name: ChannelName): IChannelAdapter | undefined {
    return this.adapters.get(name);
  }

  listActive(): ChannelName[] {
    return this.order.filter((name) => this.adapters.get(name)?.enabled);
  }

  async getForInbound(channel: ChannelName, raw: unknown): Promise<ChannelMessage | null> {
    const adapter = this.adapters.get(channel);
    if (!adapter || !adapter.enabled) return null;
    return Promise.resolve(adapter.parseInbound(raw));
  }
}

export const channelRegistry = new ChannelRegistry();
