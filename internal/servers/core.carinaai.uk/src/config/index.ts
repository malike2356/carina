import { loadCarinaEnv } from './load-env.js';
import { applyYamlConfigToEnv } from '../cli/config/loader.js';

loadCarinaEnv();
applyYamlConfigToEnv();

function intEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const DOMAIN = process.env.CARINA_DOMAIN ?? 'carinaai.uk';

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    model: process.env.DEEPSEEK_MODEL ?? process.env.DEFAULT_MODEL ?? 'deepseek-chat',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/carina',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  cache: {
    ttlSeconds: {
      webSearch: intEnv('CARINA_CACHE_TTL_WEB_SEARCH_SECONDS', 60 * 60),
      propertyCompliance: intEnv('CARINA_CACHE_TTL_PROPERTY_COMPLIANCE_SECONDS', 24 * 60 * 60),
      aiClassification: intEnv('CARINA_CACHE_TTL_AI_CLASSIFICATION_SECONDS', 60 * 60),
      marketData: {
        default: intEnv('CARINA_CACHE_TTL_MARKET_DATA_SECONDS', 30 * 60),
        propertyData: intEnv(
          'CARINA_CACHE_TTL_MARKET_DATA_PROPERTY_DATA_SECONDS',
          intEnv('CARINA_CACHE_TTL_MARKET_DATA_SECONDS', 30 * 60),
        ),
      },
    },
  },
  brave: {
    apiKey: process.env.BRAVE_SEARCH_API_KEY ?? '',
    searchUrl: process.env.BRAVE_SEARCH_URL ?? 'https://api.search.brave.com/res/v1/web/search',
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY ?? '',
    searchUrl: process.env.TAVILY_SEARCH_URL ?? 'https://api.tavily.com/search',
    searchDepth:
      process.env.TAVILY_SEARCH_DEPTH === 'advanced' ? ('advanced' as const) : ('basic' as const),
  },
  searxng: {
    url: process.env.SEARXNG_URL ?? '',
  },
  search: {
    provider: (() => {
      const raw = (process.env.SEARCH_PROVIDER ?? '').trim().toLowerCase();
      if (raw === 'brave' || raw === 'tavily' || raw === 'searxng') return raw;
      return 'auto' as const;
    })(),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? '',
    from: `Carina <hello@${DOMAIN}>`,
  },
  imap: {
    host: process.env.IMAP_HOST ?? '',
    port: parseInt(process.env.IMAP_PORT ?? '993', 10),
    user: process.env.IMAP_USER ?? '',
    password: process.env.IMAP_PASSWORD ?? '',
    tls: process.env.IMAP_TLS !== 'false',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.resend.com',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    user: process.env.SMTP_USER ?? 'resend',
    password: process.env.SMTP_PASSWORD ?? process.env.RESEND_API_KEY ?? '',
    from: process.env.SMTP_FROM ?? process.env.RESEND_FROM ?? `hello@${DOMAIN}`,
    tls: process.env.SMTP_TLS !== 'false',
  },
  caldav: {
    url: process.env.CALDAV_URL ?? '',
    username: process.env.CALDAV_USERNAME ?? '',
    password: process.env.CALDAV_PASSWORD ?? '',
    principalUrl: process.env.CALDAV_PRINCIPAL_URL ?? '',
  },
  propertyData: {
    apiKey: process.env.PROPERTY_DATA_API_KEY ?? '',
  },
  landRegistry: {
    apiKey: process.env.LAND_REGISTRY_API_KEY ?? '',
    baseUrl: process.env.LAND_REGISTRY_BASE_URL ?? 'https://api.propertydata.co.uk',
  },
  irc: {
    enabled: process.env.IRC_ENABLED === 'true',
    live: process.env.IRC_LIVE !== 'false',
    server: process.env.IRC_SERVER ?? '',
    port: parseInt(process.env.IRC_PORT ?? '6697', 10),
    tls: process.env.IRC_TLS !== 'false',
    nick: process.env.IRC_NICK ?? '',
    username: process.env.IRC_USERNAME ?? process.env.IRC_NICK ?? '',
    realname: process.env.IRC_REALNAME ?? 'Carina AI',
    password: process.env.IRC_PASSWORD ?? '',
    channels: (process.env.IRC_CHANNELS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    mentionOnly: process.env.IRC_MENTION_ONLY !== 'false',
    nickservIdentify: process.env.IRC_NICKSERV_IDENTIFY === 'true',
  },
  carina: {
    defaultProvider: process.env.DEFAULT_PROVIDER ?? '',
    activePack: process.env.ACTIVE_SKILL_PACK ?? '',
    activePacks: (process.env.ACTIVE_SKILL_PACKS ?? process.env.ACTIVE_SKILL_PACK ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    resourcesDir: process.env.CARINA_RESOURCES_DIR ?? '',
    sessionTimeout: intEnv('CARINA_SESSION_TIMEOUT_MS', 60 * 60 * 1000),
    maxMemoryContext: intEnv('CARINA_MAX_MEMORY_CONTEXT', 20),
    maxTurns: intEnv('CARINA_MAX_TURNS', 20),
    subagentMaxTurns: intEnv('CARINA_SUBAGENT_MAX_TURNS', 10),
    taskflowMaxTurns: intEnv('CARINA_TASKFLOW_MAX_TURNS', 8),
    contextCharBudget: intEnv('CARINA_CONTEXT_CHAR_BUDGET', 48_000),
    skillAutoWrite: process.env.SKILL_AUTO_WRITE !== 'false',
    llmMonthlyBudgetUsd: process.env.CARINA_LLM_MONTHLY_BUDGET_USD
      ? parseFloat(process.env.CARINA_LLM_MONTHLY_BUDGET_USD)
      : null,
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  product: {
    domain: DOMAIN,
    marketingUrl: `https://${DOMAIN}`,
    appUrl: `https://app.${DOMAIN}`,
    coreUrl: `https://core.${DOMAIN}`,
    opsUrl: `https://ops.${DOMAIN}`,
    hubUrl: `https://hub.${DOMAIN}`,
    docsUrl: `https://docs.${DOMAIN}`,
    installUrl: `https://install.${DOMAIN}`,
    skillsUrl: `https://skills.${DOMAIN}`,
    supportEmail: `hello@${DOMAIN}`,
  },
  tts: {
    provider: (process.env.TTS_PROVIDER ?? 'edge') as 'edge' | 'openai',
    voice: process.env.TTS_VOICE ?? 'en-GB-SoniaNeural',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN ?? '',
    applicationId: process.env.DISCORD_APPLICATION_ID ?? '',
    publicKey: process.env.DISCORD_PUBLIC_KEY ?? '',
    allowedChannelIds: (process.env.DISCORD_ALLOWED_CHANNEL_IDS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN ?? '',
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
    appToken: process.env.SLACK_APP_TOKEN ?? '',
    socketMode: process.env.SLACK_SOCKET_MODE === 'true',
    port: parseInt(process.env.SLACK_PORT ?? '3002', 10),
    allowedChannelIds: (process.env.SLACK_ALLOWED_CHANNEL_IDS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? process.env.TWILIO_FROM_NUMBER ?? '',
  },
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  },
  web: {
    enabled: process.env.WEB_ENABLED !== 'false',
    port: parseInt(process.env.WEB_PORT ?? process.env.PORT ?? '3000', 10),
  },
  hosted: {
    enabled: process.env.HOSTED_MODE === 'true',
    cloudEnabled: process.env.CARINA_CLOUD_ENABLED === 'true',
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    appHost: process.env.CARINA_HOSTED_APP_HOST ?? `app.${DOMAIN}`,
    operatorHosts: (process.env.CARINA_OPERATOR_HOSTS ?? `core.${DOMAIN},localhost`)
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
    stripePrices: {
      scoutMonitor: process.env.STRIPE_PRICE_SCOUT_MONITOR ?? '',
      scoutPro: process.env.STRIPE_PRICE_SCOUT_PRO ?? process.env.STRIPE_PRICE_SCOUT_STANDARD ?? '',
      scoutStandard: process.env.STRIPE_PRICE_SCOUT_STANDARD ?? '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
      carinaOpsStarter: process.env.STRIPE_PRICE_CARINA_OPS_STARTER ?? '',
      carinaOpsTeam: process.env.STRIPE_PRICE_CARINA_OPS_TEAM ?? '',
    },
    freeDailyMessages: intEnv('CARINA_CLOUD_FREE_DAILY_MESSAGES', 100),
    bootstrapEmail: process.env.HOSTED_BOOTSTRAP_EMAIL ?? '',
    bootstrapPassword: process.env.HOSTED_BOOTSTRAP_PASSWORD ?? '',
  },
  carinaOps: {
    productEnabled: process.env.CARINA_OPS_PRODUCT_ENABLED === 'true',
    managedWorkbenchEnabled: process.env.CARINA_OPS_MANAGED_WORKBENCH_ENABLED === 'true',
  },
  hub: {
    url: process.env.SKILLS_HUB_URL ?? process.env.HUB_URL ?? `https://hub.${DOMAIN}`,
    port: parseInt(process.env.SKILLS_HUB_PORT ?? '3001', 10),
    databaseUrl:
      process.env.SKILLS_HUB_DATABASE_URL
      ?? process.env.DATABASE_URL
      ?? 'postgresql://localhost:5432/carina_skills_hub',
    publishApiKey: process.env.SKILLS_HUB_PUBLISH_KEY ?? '',
    stripeSecretKey: process.env.HUB_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.HUB_STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? '',
    checkoutSuccessUrl: process.env.HUB_CHECKOUT_SUCCESS_URL ?? `https://hub.${DOMAIN}/?purchase=success`,
    checkoutCancelUrl: process.env.HUB_CHECKOUT_CANCEL_URL ?? `https://hub.${DOMAIN}/?purchase=cancel`,
    authorRevenueShareBps: intEnv('HUB_PACK_AUTHOR_REVENUE_SHARE_BPS', 7000),
    carinaRevenueShareBps: intEnv('HUB_PACK_CARINA_REVENUE_SHARE_BPS', 2000),
    platformFeeBps: intEnv('HUB_PACK_PLATFORM_FEE_BPS', 1000),
  },
  labyrinth: {
    enabled: process.env.LABYRINTH_ENABLED === 'true' || process.env.SCOUT_ENABLED === 'true',
    url: process.env.SCOUT_API_URL ?? process.env.LABYRINTH_URL ?? 'http://localhost:4444',
    apiKey: process.env.SCOUT_API_KEY ?? process.env.LABYRINTH_API_KEY ?? '',
    instanceId: process.env.CARINA_INSTANCE_ID ?? process.env.SCOUT_INSTANCE_ID ?? process.env.LABYRINTH_INSTANCE_ID ?? 'carina-local',
    instanceName: process.env.LABYRINTH_INSTANCE_NAME ?? 'Carina Local',
    llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL ?? 'http://localhost:3000',
    judgeModel: process.env.LABYRINTH_JUDGE_MODEL ?? 'deepseek/deepseek-chat',
    judgeTimeoutMs: intEnv('LABYRINTH_JUDGE_TIMEOUT_MS', 3000),
  },
  embeddings: {
    dimensions: intEnv('CARINA_EMBEDDING_DIMENSIONS', 768),
    maxChars: intEnv('CARINA_EMBEDDING_MAX_CHARS', 8000),
    voyageMaxChars: intEnv('CARINA_EMBEDDING_VOYAGE_MAX_CHARS', 16000),
    geminiModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004',
    openaiModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  },
  ntfy: {
    baseUrl: process.env.NTFY_BASE_URL ?? 'https://ntfy.sh',
    topic: process.env.NTFY_TOPIC ?? '',
    token: process.env.NTFY_TOKEN ?? '',
  },
  n8n: {
    baseUrl: process.env.N8N_BASE_URL ?? '',
    apiKey: process.env.N8N_API_KEY ?? '',
  },
  trello: {
    apiKey: process.env.TRELLO_API_KEY ?? '',
    token: process.env.TRELLO_TOKEN ?? '',
    baseUrl: process.env.TRELLO_BASE_URL ?? 'https://api.trello.com/1',
  },
  pushover: {
    token: process.env.PUSHOVER_TOKEN ?? '',
    user: process.env.PUSHOVER_USER ?? '',
  },
  gotify: {
    url: process.env.GOTIFY_URL ?? '',
    token: process.env.GOTIFY_TOKEN ?? '',
  },
  messenger: {
    pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN ?? '',
    verifyToken: process.env.MESSENGER_VERIFY_TOKEN ?? '',
    appSecret: process.env.MESSENGER_APP_SECRET ?? '',
  },
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
    verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN ?? '',
    appSecret: process.env.INSTAGRAM_APP_SECRET ?? '',
  },
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN ?? '',
    apiKey: process.env.TWITTER_API_KEY ?? '',
    apiSecret: process.env.TWITTER_API_SECRET ?? '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN ?? '',
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET ?? '',
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET ?? '',
    botUserId: process.env.TWITTER_BOT_USER_ID ?? '',
    webhookEnv: process.env.TWITTER_WEBHOOK_ENV ?? '',
  },
  rocketchat: {
    url: process.env.ROCKETCHAT_URL ?? '',
    botUserId: process.env.ROCKETCHAT_BOT_USER_ID ?? '',
    botAuthToken: process.env.ROCKETCHAT_BOT_AUTH_TOKEN ?? '',
    webhookSecret: process.env.ROCKETCHAT_WEBHOOK_SECRET ?? '',
  },
  webex: {
    botToken: process.env.WEBEX_BOT_TOKEN ?? '',
    webhookSecret: process.env.WEBEX_WEBHOOK_SECRET ?? '',
  },
  kakaotalk: {
    apiKey: process.env.KAKAOTALK_API_KEY ?? '',
    botId: process.env.KAKAOTALK_BOT_ID ?? '',
    webhookSecret: process.env.KAKAOTALK_WEBHOOK_SECRET ?? '',
  },
  zalo: {
    appId: process.env.ZALO_APP_ID ?? '',
    appSecret: process.env.ZALO_APP_SECRET ?? '',
    oaAccessToken: process.env.ZALO_OA_ACCESS_TOKEN ?? '',
    refreshToken: process.env.ZALO_REFRESH_TOKEN ?? '',
  },
  threema: {
    gatewayId: process.env.THREEMA_GATEWAY_ID ?? '',
    gatewaySecret: process.env.THREEMA_GATEWAY_SECRET ?? '',
    privateKey: process.env.THREEMA_PRIVATE_KEY ?? '',
  },
  wire: {
    botClientId: process.env.WIRE_BOT_CLIENT_ID ?? '',
    botToken: process.env.WIRE_BOT_TOKEN ?? '',
    botSecret: process.env.WIRE_BOT_SECRET ?? '',
    apiBase: process.env.WIRE_API_BASE ?? 'https://prod-nginz-https.wire.com',
  },
  keybase: {
    username: process.env.KEYBASE_USERNAME ?? '',
    paperkey: process.env.KEYBASE_PAPERKEY ?? '',
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID ?? '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
    eventsubSecret: process.env.TWITCH_EVENTSUB_SECRET ?? '',
    botUsername: process.env.TWITCH_BOT_USERNAME ?? '',
    channel: process.env.TWITCH_CHANNEL ?? '',
    channelId: process.env.TWITCH_CHANNEL_ID ?? '',
    botUserId: process.env.TWITCH_BOT_USER_ID ?? '',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
    botChannelId: process.env.YOUTUBE_BOT_CHANNEL_ID ?? '',
    oauthClientId: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? '',
    oauthClientSecret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '',
    oauthRefreshToken: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN ?? '',
    liveChatId: process.env.YOUTUBE_LIVE_CHAT_ID ?? '',
  },
  groupme: {
    botId: process.env.GROUPME_BOT_ID ?? '',
    botToken: process.env.GROUPME_BOT_TOKEN ?? '',
    groupId: process.env.GROUPME_GROUP_ID ?? '',
    botUserId: process.env.GROUPME_BOT_USER_ID ?? '',
  },
  nextcloudTalk: {
    url: process.env.NEXTCLOUD_URL ?? '',
    botSecret: process.env.NEXTCLOUD_BOT_SECRET ?? '',
    botUser: process.env.NEXTCLOUD_BOT_USER ?? '',
  },
  linkedin: {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? '',
    clientId: process.env.LINKEDIN_CLIENT_ID ?? '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    webhookSecret: process.env.LINKEDIN_WEBHOOK_SECRET ?? '',
  },
  zulip: {
    site: process.env.ZULIP_SITE ?? '',
    botEmail: process.env.ZULIP_BOT_EMAIL ?? '',
    apiKey: process.env.ZULIP_API_KEY ?? '',
  },
  reddit: {
    webhookSecret: process.env.REDDIT_WEBHOOK_SECRET ?? '',
  },
  bluesky: {
    handle: process.env.BLUESKY_HANDLE ?? '',
    appPassword: process.env.BLUESKY_APP_PASSWORD ?? '',
    serviceUrl: process.env.BLUESKY_SERVICE_URL ?? 'https://bsky.social',
  },
  skype: {
    appId: process.env.SKYPE_APP_ID ?? '',
    appSecret: process.env.SKYPE_APP_SECRET ?? '',
    serviceUrl: process.env.SKYPE_SERVICE_URL ?? '',
  },
  pumble: {
    webhookUrl: process.env.PUMBLE_WEBHOOK_URL ?? '',
  },
  twist: {
    integrationToken: process.env.TWIST_INTEGRATION_TOKEN ?? '',
  },
  ryver: {
    webhookUrl: process.env.RYVER_WEBHOOK_URL ?? '',
  },
  workplace: {
    pageAccessToken: process.env.WORKPLACE_PAGE_ACCESS_TOKEN ?? '',
    appSecret: process.env.WORKPLACE_APP_SECRET ?? '',
    verifyToken: process.env.WORKPLACE_VERIFY_TOKEN ?? '',
  },
  naverWorks: {
    botId: process.env.NAVER_WORKS_BOT_ID ?? '',
    botSecret: process.env.NAVER_WORKS_BOT_SECRET ?? '',
    apiBase: process.env.NAVER_WORKS_API_BASE ?? '',
  },
  qq: {
    appId: process.env.QQ_BOT_APP_ID ?? '',
    token: process.env.QQ_BOT_TOKEN ?? '',
    apiBase: process.env.QQ_BOT_API_BASE ?? '',
  },
  weibo: {
    appKey: process.env.WEIBO_APP_KEY ?? '',
    appSecret: process.env.WEIBO_APP_SECRET ?? '',
    accessToken: process.env.WEIBO_ACCESS_TOKEN ?? '',
    apiBase: process.env.WEIBO_API_BASE ?? '',
  },
  openhab: {
    url: process.env.OPENHAB_URL ?? '',
    token: process.env.OPENHAB_TOKEN ?? '',
  },
  synologyChat: {
    token: process.env.SYNOLOGY_CHAT_TOKEN ?? '',
    webhookUrl: process.env.SYNOLOGY_CHAT_WEBHOOK_URL ?? '',
  },
  gitter: {
    token: process.env.GITTER_TOKEN ?? '',
  },
  element: {
    webhookUrl: process.env.ELEMENT_WEBHOOK_URL ?? '',
  },
  mastodon: {
    instance: process.env.MASTODON_INSTANCE ?? '',
    accessToken: process.env.MASTODON_ACCESS_TOKEN ?? '',
  },
  snapchat: {
    webhookSecret: process.env.SNAPCHAT_WEBHOOK_SECRET ?? '',
  },
  bridgeGeneric: {
    secret: process.env.BRIDGE_CHANNEL_SECRET ?? '',
  },
  appleBusinessChat: {
    merchantId: process.env.ABC_MERCHANT_ID ?? '',
    apiKey: process.env.ABC_API_KEY ?? '',
    apiBase: process.env.ABC_API_BASE ?? '',
  },
} as const;
