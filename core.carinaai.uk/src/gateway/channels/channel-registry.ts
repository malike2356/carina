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
    return adapter.parseInbound(raw);
  }
}

export const channelRegistry = new ChannelRegistry();
