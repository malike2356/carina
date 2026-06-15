import type { ChannelName } from './channel-adapter.interface.js';

export type CatalogChannelName =
  | 'ntfy'
  | 'pushover'
  | 'zulip'
  | 'rocketchat'
  | 'twitch'
  | 'reddit'
  | 'bluesky'
  | 'messenger'
  | 'instagram'
  | 'nextcloud-talk'
  | 'groupme'
  | 'linkedin'
  | 'skype'
  | 'gotify'
  | 'pumble'
  | 'twist'
  | 'ryver'
  | 'workplace'
  | 'threema'
  | 'kakaotalk'
  | 'naver-works'
  | 'qq'
  | 'weibo'
  | 'openhab'
  | 'synology-chat'
  | 'keybase'
  | 'gitter'
  | 'element'
  | 'mastodon'
  | 'snapchat'
  | 'bridge-generic'
  | 'apple-business-chat';

export const CATALOG_CHANNEL_NAMES: readonly CatalogChannelName[] = [
  'ntfy',
  'pushover',
  'zulip',
  'rocketchat',
  'twitch',
  'reddit',
  'bluesky',
  'messenger',
  'instagram',
  'nextcloud-talk',
  'groupme',
  'linkedin',
  'skype',
  'gotify',
  'pumble',
  'twist',
  'ryver',
  'workplace',
  'threema',
  'kakaotalk',
  'naver-works',
  'qq',
  'weibo',
  'openhab',
  'synology-chat',
  'keybase',
  'gitter',
  'element',
  'mastodon',
  'snapchat',
  'bridge-generic',
  'apple-business-chat',
] as const;

const PUSH_NOTIFICATION_CHANNELS = new Set<string>(['ntfy', 'pushover', 'gotify']);
const META_GRAPH_CHANNELS = new Set<string>(['messenger', 'instagram']);
const FULL_ADAPTER_CHANNELS = new Set<string>([
  'rocketchat',
  'kakaotalk',
  'threema',
  'keybase',
  'twitch',
  'groupme',
  'nextcloud-talk',
  'linkedin',
]);

export const CATALOG_STUB_CHANNELS = new Set<string>([
  'irc',
  ...CATALOG_CHANNEL_NAMES.filter((name) => (
    !PUSH_NOTIFICATION_CHANNELS.has(name)
    && !META_GRAPH_CHANNELS.has(name)
    && !FULL_ADAPTER_CHANNELS.has(name)
  )),
]);

export type CatalogChannelSpec = {
  channel: ChannelName;
  env: string[];
  note: string;
  webhook?: string;
  checkConfigured: () => boolean;
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

function catalogSpec(
  channel: CatalogChannelName,
  env: string[],
  note: string,
  webhook: string,
): CatalogChannelSpec {
  return {
    channel,
    env,
    note,
    webhook,
    checkConfigured: () => hasAnyEnv(env),
    transport: () => 'webhook-stub',
  };
}

/** Webhook-contract channels: inbound POST + operator outbound via send-message/http-request. */
export function buildCatalogChannelSpecs(): CatalogChannelSpec[] {
  return [
    {
      channel: 'ntfy',
      env: ['NTFY_TOPIC', 'NTFY_BASE_URL', 'NTFY_TOKEN'],
      note: 'ntfy.sh push notifications (outbound-only)',
      checkConfigured: () => hasEnv(['NTFY_TOPIC']),
      transport: () => 'push-api',
    },
    {
      channel: 'pushover',
      env: ['PUSHOVER_TOKEN', 'PUSHOVER_USER'],
      note: 'Pushover mobile alerts (outbound-only)',
      checkConfigured: () => hasEnv(['PUSHOVER_TOKEN', 'PUSHOVER_USER']),
      transport: () => 'push-api',
    },
    catalogSpec('zulip', ['ZULIP_BOT_EMAIL', 'ZULIP_API_KEY', 'ZULIP_SITE'], 'Zulip team chat', '/webhooks/zulip'),
    {
      channel: 'rocketchat',
      env: [
        'ROCKETCHAT_URL',
        'ROCKETCHAT_BOT_USER_ID',
        'ROCKETCHAT_BOT_AUTH_TOKEN',
        'ROCKETCHAT_WEBHOOK_SECRET',
      ],
      note: 'Rocket.Chat outgoing webhook and bot API',
      webhook: '/webhooks/rocketchat',
      checkConfigured: () => hasEnv([
        'ROCKETCHAT_URL',
        'ROCKETCHAT_BOT_USER_ID',
        'ROCKETCHAT_BOT_AUTH_TOKEN',
      ]),
      transport: () => 'rocketchat-webhook',
    },
    {
      channel: 'webex',
      env: ['WEBEX_BOT_TOKEN', 'WEBEX_WEBHOOK_SECRET'],
      note: 'Cisco Webex Teams bot webhooks',
      webhook: '/webhooks/webex',
      checkConfigured: () => hasEnv(['WEBEX_BOT_TOKEN']),
      transport: () => 'webex-webhook',
    },
    {
      channel: 'twitch',
      env: [
        'TWITCH_CLIENT_ID',
        'TWITCH_CLIENT_SECRET',
        'TWITCH_EVENTSUB_SECRET',
        'TWITCH_BOT_USERNAME',
        'TWITCH_CHANNEL',
        'TWITCH_CHANNEL_ID',
        'TWITCH_BOT_USER_ID',
      ],
      note: 'Twitch EventSub chat message webhooks',
      webhook: '/webhooks/twitch',
      checkConfigured: () => hasEnv([
        'TWITCH_CLIENT_ID',
        'TWITCH_CLIENT_SECRET',
        'TWITCH_EVENTSUB_SECRET',
        'TWITCH_CHANNEL_ID',
      ]),
      transport: () => 'twitch-eventsub',
    },
    {
      channel: 'youtube',
      env: [
        'YOUTUBE_API_KEY',
        'YOUTUBE_BOT_CHANNEL_ID',
        'YOUTUBE_OAUTH_CLIENT_ID',
        'YOUTUBE_OAUTH_CLIENT_SECRET',
        'YOUTUBE_OAUTH_REFRESH_TOKEN',
        'YOUTUBE_LIVE_CHAT_ID',
      ],
      note: 'YouTube Live Chat polling and OAuth send',
      checkConfigured: () => hasEnv(['YOUTUBE_API_KEY', 'YOUTUBE_LIVE_CHAT_ID']),
      transport: () => 'youtube-livechat-poll',
    },
    catalogSpec('reddit', ['REDDIT_WEBHOOK_SECRET'], 'Reddit bot webhook bridge', '/webhooks/reddit'),
    catalogSpec('bluesky', ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'], 'Bluesky firehose/webhook bridge', '/webhooks/bluesky'),
    {
      channel: 'messenger',
      env: ['MESSENGER_PAGE_ACCESS_TOKEN', 'MESSENGER_VERIFY_TOKEN', 'MESSENGER_APP_SECRET'],
      note: 'Facebook Messenger via Meta Graph API',
      webhook: '/webhooks/messenger',
      checkConfigured: () => hasEnv([
        'MESSENGER_PAGE_ACCESS_TOKEN',
        'MESSENGER_VERIFY_TOKEN',
        'MESSENGER_APP_SECRET',
      ]),
      transport: () => 'meta-graph-webhook',
    },
    {
      channel: 'instagram',
      env: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_VERIFY_TOKEN', 'INSTAGRAM_APP_SECRET'],
      note: 'Instagram Business via Meta Graph API',
      webhook: '/webhooks/instagram',
      checkConfigured: () => hasEnv([
        'INSTAGRAM_ACCESS_TOKEN',
        'INSTAGRAM_VERIFY_TOKEN',
        'INSTAGRAM_APP_SECRET',
      ]),
      transport: () => 'meta-graph-webhook',
    },
    {
      channel: 'twitter',
      env: [
        'TWITTER_BEARER_TOKEN',
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
        'TWITTER_WEBHOOK_ENV',
        'TWITTER_CONSUMER_SECRET',
        'TWITTER_BOT_USER_ID',
      ],
      note: 'Twitter/X Direct Messages via Account Activity API',
      webhook: '/webhooks/twitter',
      checkConfigured: () => hasEnv([
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
        'TWITTER_CONSUMER_SECRET',
      ]),
      transport: () => 'twitter-account-activity',
    },
    {
      channel: 'nextcloud-talk',
      env: ['NEXTCLOUD_URL', 'NEXTCLOUD_BOT_SECRET', 'NEXTCLOUD_BOT_USER'],
      note: 'Nextcloud Talk bot webhook and chat API',
      webhook: '/webhooks/nextcloud-talk',
      checkConfigured: () => hasEnv(['NEXTCLOUD_URL', 'NEXTCLOUD_BOT_SECRET']),
      transport: () => 'nextcloud-talk-webhook',
    },
    {
      channel: 'groupme',
      env: ['GROUPME_BOT_ID', 'GROUPME_BOT_TOKEN', 'GROUPME_GROUP_ID', 'GROUPME_BOT_USER_ID'],
      note: 'GroupMe group bot callback and post API',
      webhook: '/webhooks/groupme',
      checkConfigured: () => hasEnv(['GROUPME_BOT_ID']),
      transport: () => 'groupme-callback',
    },
    {
      channel: 'linkedin',
      env: [
        'LINKEDIN_ACCESS_TOKEN',
        'LINKEDIN_CLIENT_ID',
        'LINKEDIN_CLIENT_SECRET',
        'LINKEDIN_WEBHOOK_SECRET',
      ],
      note: 'LinkedIn Messaging API direct messages',
      webhook: '/webhooks/linkedin',
      checkConfigured: () => hasEnv(['LINKEDIN_ACCESS_TOKEN']),
      transport: () => 'linkedin-messaging-webhook',
    },
    catalogSpec(
      'skype',
      ['SKYPE_APP_ID', 'SKYPE_APP_SECRET'],
      'Skype bot webhook bridge (catalog stub)',
      '/webhooks/skype',
    ),
    {
      channel: 'gotify',
      env: ['GOTIFY_URL', 'GOTIFY_TOKEN'],
      note: 'Gotify self-hosted push (outbound-only)',
      checkConfigured: () => hasEnv(['GOTIFY_URL', 'GOTIFY_TOKEN']),
      transport: () => 'push-api',
    },
    catalogSpec('pumble', ['PUMBLE_WEBHOOK_URL'], 'Pumble team chat', '/webhooks/pumble'),
    catalogSpec('twist', ['TWIST_INTEGRATION_TOKEN'], 'Twist async chat', '/webhooks/twist'),
    catalogSpec('ryver', ['RYVER_WEBHOOK_URL'], 'Ryver team chat', '/webhooks/ryver'),
    catalogSpec('workplace', ['WORKPLACE_APP_SECRET', 'WORKPLACE_VERIFY_TOKEN'], 'Meta Workplace', '/webhooks/workplace'),
    {
      channel: 'threema',
      env: ['THREEMA_GATEWAY_ID', 'THREEMA_GATEWAY_SECRET', 'THREEMA_PRIVATE_KEY'],
      note: 'Threema Gateway basic mode webhook and send API',
      webhook: '/webhooks/threema',
      checkConfigured: () => hasEnv(['THREEMA_GATEWAY_ID', 'THREEMA_GATEWAY_SECRET']),
      transport: () => 'threema-gateway',
    },
    {
      channel: 'wire',
      env: ['WIRE_BOT_CLIENT_ID', 'WIRE_BOT_TOKEN', 'WIRE_BOT_SECRET', 'WIRE_API_BASE'],
      note: 'Wire Bot API webhook and messaging',
      webhook: '/webhooks/wire',
      checkConfigured: () => hasEnv(['WIRE_BOT_CLIENT_ID', 'WIRE_BOT_TOKEN']),
      transport: () => 'wire-bot-webhook',
    },
    {
      channel: 'kakaotalk',
      env: ['KAKAOTALK_API_KEY', 'KAKAOTALK_BOT_ID', 'KAKAOTALK_WEBHOOK_SECRET'],
      note: 'KakaoTalk chatbot skill server (synchronous replies)',
      webhook: '/webhooks/kakaotalk',
      checkConfigured: () => hasEnv(['KAKAOTALK_API_KEY', 'KAKAOTALK_BOT_ID']),
      transport: () => 'kakaotalk-skill',
    },
    {
      channel: 'zalo',
      env: ['ZALO_APP_ID', 'ZALO_APP_SECRET', 'ZALO_OA_ACCESS_TOKEN', 'ZALO_REFRESH_TOKEN'],
      note: 'Zalo Official Account messaging',
      webhook: '/webhooks/zalo',
      checkConfigured: () => hasEnv(['ZALO_APP_ID', 'ZALO_OA_ACCESS_TOKEN']),
      transport: () => 'zalo-oa-webhook',
    },
    catalogSpec('naver-works', ['NAVER_WORKS_BOT_ID', 'NAVER_WORKS_BOT_SECRET'], 'Naver Works', '/webhooks/naver-works'),
    catalogSpec('qq', ['QQ_BOT_APP_ID', 'QQ_BOT_TOKEN'], 'QQ bot webhook', '/webhooks/qq'),
    catalogSpec('weibo', ['WEIBO_APP_KEY', 'WEIBO_APP_SECRET'], 'Weibo open platform', '/webhooks/weibo'),
    {
      channel: 'openhab',
      env: ['OPENHAB_URL', 'OPENHAB_TOKEN'],
      note: 'openHAB notification bridge',
      webhook: '/webhooks/openhab',
      checkConfigured: () => hasEnv(['OPENHAB_URL']),
      transport: () => 'webhook-stub',
    },
    catalogSpec('synology-chat', ['SYNOLOGY_CHAT_TOKEN'], 'Synology Chat incoming webhook', '/webhooks/synology-chat'),
    {
      channel: 'keybase',
      env: ['KEYBASE_USERNAME', 'KEYBASE_PAPERKEY'],
      note: 'Keybase bot via keybase-bot long-poll',
      checkConfigured: () => hasEnv(['KEYBASE_USERNAME', 'KEYBASE_PAPERKEY']),
      transport: () => 'keybase-bot-poll',
    },
    catalogSpec('gitter', ['GITTER_TOKEN'], 'Gitter room bot', '/webhooks/gitter'),
    catalogSpec('element', ['ELEMENT_WEBHOOK_URL'], 'Element/Matrix generic webhook bridge', '/webhooks/element'),
    catalogSpec('mastodon', ['MASTODON_INSTANCE', 'MASTODON_ACCESS_TOKEN'], 'Mastodon bot', '/webhooks/mastodon'),
    catalogSpec('snapchat', ['SNAPCHAT_WEBHOOK_SECRET'], 'Snapchat marketing API stub', '/webhooks/snapchat'),
    {
      channel: 'bridge-generic',
      env: ['BRIDGE_CHANNEL_ENABLED=true', 'BRIDGE_CHANNEL_SECRET'],
      note: 'Generic operator bridge with shared secret',
      webhook: '/webhooks/bridge',
      checkConfigured: () => hasEnv(['BRIDGE_CHANNEL_ENABLED=true']),
      transport: () => 'webhook-stub',
    },
    catalogSpec('apple-business-chat', ['ABC_MERCHANT_ID', 'ABC_API_KEY'], 'Apple Business Chat', '/webhooks/apple-business-chat'),
  ];
}

export function isCatalogStubChannel(channel: string): boolean {
  return CATALOG_STUB_CHANNELS.has(channel);
}
