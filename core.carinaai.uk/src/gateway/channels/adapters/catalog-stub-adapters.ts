import { config } from '../../../config/index.js';
import type { ChannelName } from '../channel-adapter.interface.js';
import {
  createCatalogWebhookAdapter,
  CatalogWebhookAdapter,
  verifyHmacSha256,
  verifySharedSecret,
  headerValue,
  type CatalogWebhookOptions,
} from './catalog-webhook-base.js';
import {
  parseAppleBusinessChatInbound,
  parseBlueskyInbound,
  parseBridgeGenericInbound,
  parseElementInbound,
  parseGitterInbound,
  parseMastodonInbound,
  parseNaverWorksInbound,
  parseOpenhabInbound,
  parsePumbleInbound,
  parseQqInbound,
  parseRedditInbound,
  parseRyverInbound,
  parseSkypeInbound,
  parseSnapchatInbound,
  parseSynologyChatInbound,
  parseTwistInbound,
  parseWeiboInbound,
  parseWorkplaceInbound,
  parseZulipInbound,
} from './catalog-webhook-parsers.js';
import {
  sendAppleBusinessChatMessage,
  sendBlueskyMessage,
  sendBridgeGenericMessage,
  sendElementMessage,
  sendGitterMessage,
  sendMastodonMessage,
  sendNaverWorksMessage,
  sendOpenhabMessage,
  sendPumbleMessage,
  sendQqMessage,
  sendRedditMessage,
  sendRyverMessage,
  sendSkypeMessage,
  sendSnapchatMessage,
  sendSynologyChatMessage,
  sendTwistMessage,
  sendWeiboMessage,
  sendWorkplaceMessage,
  sendZulipMessage,
} from './catalog-webhook-sends.js';

type StubAdapterDef = CatalogWebhookOptions & { configured: () => boolean };

const STUB_ADAPTER_DEFS: StubAdapterDef[] = [
  {
    name: 'zulip',
    transport: 'zulip-bot-api',
    configured: () => Boolean(config.zulip.site && config.zulip.botEmail && config.zulip.apiKey),
    checkConfigured: () => Boolean(config.zulip.site && config.zulip.botEmail && config.zulip.apiKey),
    parseInbound: parseZulipInbound,
    sendMessage: sendZulipMessage,
  },
  {
    name: 'reddit',
    transport: 'reddit-webhook-bridge',
    configured: () => Boolean(config.reddit.webhookSecret),
    checkConfigured: () => Boolean(config.reddit.webhookSecret),
    parseInbound: parseRedditInbound,
    sendMessage: sendRedditMessage,
    validateWebhook: (input) => verifySharedSecret(input, config.reddit.webhookSecret, ['x-reddit-secret', 'x-webhook-secret']),
  },
  {
    name: 'bluesky',
    transport: 'bluesky-atproto',
    configured: () => Boolean(config.bluesky.handle && config.bluesky.appPassword),
    checkConfigured: () => Boolean(config.bluesky.handle && config.bluesky.appPassword),
    parseInbound: parseBlueskyInbound,
    sendMessage: sendBlueskyMessage,
  },
  {
    name: 'skype',
    transport: 'skype-bot-framework',
    configured: () => Boolean(config.skype.appId && config.skype.appSecret),
    checkConfigured: () => Boolean(config.skype.appId && config.skype.appSecret),
    parseInbound: parseSkypeInbound,
    sendMessage: sendSkypeMessage,
  },
  {
    name: 'pumble',
    transport: 'pumble-webhook',
    configured: () => Boolean(config.pumble.webhookUrl),
    checkConfigured: () => Boolean(config.pumble.webhookUrl),
    parseInbound: parsePumbleInbound,
    sendMessage: sendPumbleMessage,
  },
  {
    name: 'twist',
    transport: 'twist-api',
    configured: () => Boolean(config.twist.integrationToken),
    checkConfigured: () => Boolean(config.twist.integrationToken),
    parseInbound: parseTwistInbound,
    sendMessage: sendTwistMessage,
  },
  {
    name: 'ryver',
    transport: 'ryver-webhook',
    configured: () => Boolean(config.ryver.webhookUrl),
    checkConfigured: () => Boolean(config.ryver.webhookUrl),
    parseInbound: parseRyverInbound,
    sendMessage: sendRyverMessage,
  },
  {
    name: 'workplace',
    transport: 'workplace-graph-webhook',
    configured: () => Boolean(config.workplace.pageAccessToken && config.workplace.verifyToken),
    checkConfigured: () => Boolean(config.workplace.pageAccessToken),
    parseInbound: parseWorkplaceInbound,
    sendMessage: sendWorkplaceMessage,
    validateWebhook: (input) => verifySharedSecret(input, config.workplace.appSecret || config.workplace.verifyToken),
  },
  {
    name: 'naver-works',
    transport: 'naver-works-bot-api',
    configured: () => Boolean(config.naverWorks.botId && config.naverWorks.botSecret),
    checkConfigured: () => Boolean(config.naverWorks.botId && config.naverWorks.botSecret),
    parseInbound: parseNaverWorksInbound,
    sendMessage: sendNaverWorksMessage,
  },
  {
    name: 'qq',
    transport: 'qq-bot-api',
    configured: () => Boolean(config.qq.appId && config.qq.token),
    checkConfigured: () => Boolean(config.qq.appId && config.qq.token),
    parseInbound: parseQqInbound,
    sendMessage: sendQqMessage,
  },
  {
    name: 'weibo',
    transport: 'weibo-open-api',
    configured: () => Boolean(config.weibo.appKey && config.weibo.appSecret),
    checkConfigured: () => Boolean(config.weibo.appKey || config.weibo.accessToken),
    parseInbound: parseWeiboInbound,
    sendMessage: sendWeiboMessage,
  },
  {
    name: 'openhab',
    transport: 'openhab-notifications',
    configured: () => Boolean(config.openhab.url),
    checkConfigured: () => Boolean(config.openhab.url),
    parseInbound: parseOpenhabInbound,
    sendMessage: sendOpenhabMessage,
  },
  {
    name: 'synology-chat',
    transport: 'synology-chat-webhook',
    configured: () => Boolean(config.synologyChat.token || config.synologyChat.webhookUrl),
    checkConfigured: () => Boolean(config.synologyChat.token || config.synologyChat.webhookUrl),
    parseInbound: parseSynologyChatInbound,
    sendMessage: sendSynologyChatMessage,
  },
  {
    name: 'gitter',
    transport: 'gitter-api',
    configured: () => Boolean(config.gitter.token),
    checkConfigured: () => Boolean(config.gitter.token),
    parseInbound: parseGitterInbound,
    sendMessage: sendGitterMessage,
  },
  {
    name: 'element',
    transport: 'element-webhook-bridge',
    configured: () => Boolean(config.element.webhookUrl),
    checkConfigured: () => Boolean(config.element.webhookUrl),
    parseInbound: parseElementInbound,
    sendMessage: sendElementMessage,
  },
  {
    name: 'mastodon',
    transport: 'mastodon-rest-api',
    configured: () => Boolean(config.mastodon.instance && config.mastodon.accessToken),
    checkConfigured: () => Boolean(config.mastodon.instance && config.mastodon.accessToken),
    parseInbound: parseMastodonInbound,
    sendMessage: sendMastodonMessage,
  },
  {
    name: 'snapchat',
    transport: 'snapchat-webhook',
    configured: () => Boolean(config.snapchat.webhookSecret),
    checkConfigured: () => Boolean(config.snapchat.webhookSecret),
    parseInbound: parseSnapchatInbound,
    sendMessage: sendSnapchatMessage,
    validateWebhook: (input) => {
      const rawBody = input.rawBody ?? JSON.stringify(input.body ?? {});
      const sig = headerValue(input.headers['x-snapchat-signature'] ?? input.headers['x-hub-signature-256']);
      return verifyHmacSha256(rawBody, config.snapchat.webhookSecret, sig, 'sha256=');
    },
  },
  {
    name: 'bridge-generic',
    transport: 'bridge-generic-webhook',
    configured: () => process.env.BRIDGE_CHANNEL_ENABLED === 'true',
    checkConfigured: () => process.env.BRIDGE_CHANNEL_ENABLED === 'true',
    parseInbound: parseBridgeGenericInbound,
    sendMessage: sendBridgeGenericMessage,
    validateWebhook: (input) => verifySharedSecret(input, config.bridgeGeneric.secret),
  },
  {
    name: 'apple-business-chat',
    transport: 'abc-messages-api',
    configured: () => Boolean(config.appleBusinessChat.merchantId && config.appleBusinessChat.apiKey),
    checkConfigured: () => Boolean(config.appleBusinessChat.merchantId && config.appleBusinessChat.apiKey),
    parseInbound: parseAppleBusinessChatInbound,
    sendMessage: sendAppleBusinessChatMessage,
  },
];

const adapterClasses = new Map<ChannelName, new (enabled?: boolean) => CatalogWebhookAdapter>();

for (const def of STUB_ADAPTER_DEFS) {
  class ChannelAdapter extends CatalogWebhookAdapter {
    constructor(enabled = def.configured()) {
      super(enabled, def);
    }
  }
  adapterClasses.set(def.name, ChannelAdapter as new (enabled?: boolean) => CatalogWebhookAdapter);
}

export function createStubChannelAdapter(name: ChannelName, enabled?: boolean): CatalogWebhookAdapter | null {
  const def = STUB_ADAPTER_DEFS.find((d) => d.name === name);
  if (!def) return null;
  return createCatalogWebhookAdapter(enabled ?? def.configured(), def);
}

export function getStubChannelAdapterClass(name: ChannelName): (new (enabled?: boolean) => CatalogWebhookAdapter) | null {
  return adapterClasses.get(name) ?? null;
}

export const STUB_CHANNEL_NAMES = STUB_ADAPTER_DEFS.map((d) => d.name);

export {
  parseZulipInbound,
  parseRedditInbound,
  parseBlueskyInbound,
  parseSkypeInbound,
  parsePumbleInbound,
  parseTwistInbound,
  parseRyverInbound,
  parseWorkplaceInbound,
  parseNaverWorksInbound,
  parseQqInbound,
  parseWeiboInbound,
  parseOpenhabInbound,
  parseSynologyChatInbound,
  parseGitterInbound,
  parseElementInbound,
  parseMastodonInbound,
  parseSnapchatInbound,
  parseBridgeGenericInbound,
  parseAppleBusinessChatInbound,
};

export class ZulipAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[0]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[0]!); }
}
export class RedditAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[1]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[1]!); }
}
export class BlueskyAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[2]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[2]!); }
}
export class SkypeAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[3]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[3]!); }
}
export class PumbleAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[4]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[4]!); }
}
export class TwistAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[5]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[5]!); }
}
export class RyverAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[6]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[6]!); }
}
export class WorkplaceAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[7]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[7]!); }
}
export class NaverWorksAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[8]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[8]!); }
}
export class QqAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[9]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[9]!); }
}
export class WeiboAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[10]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[10]!); }
}
export class OpenhabAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[11]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[11]!); }
}
export class SynologyChatAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[12]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[12]!); }
}
export class GitterAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[13]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[13]!); }
}
export class ElementAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[14]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[14]!); }
}
export class MastodonAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[15]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[15]!); }
}
export class SnapchatAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[16]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[16]!); }
}
export class BridgeGenericAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[17]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[17]!); }
}
export class AppleBusinessChatAdapter extends CatalogWebhookAdapter {
  constructor(enabled = STUB_ADAPTER_DEFS[18]!.configured()) { super(enabled, STUB_ADAPTER_DEFS[18]!); }
}
