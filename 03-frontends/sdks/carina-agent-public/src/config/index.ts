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
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: 'Carina <hello@carinaai.uk>',
  },
  propertyData: {
    apiKey: process.env.PROPERTY_DATA_API_KEY ?? '',
  },
  landRegistry: {
    apiKey: process.env.LAND_REGISTRY_API_KEY ?? '',
  },
  carina: {
    defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'deepseek') as 'anthropic' | 'openai' | 'deepseek',
    activePack: process.env.ACTIVE_SKILL_PACK ?? '',
    activePacks: (process.env.ACTIVE_SKILL_PACKS ?? process.env.ACTIVE_SKILL_PACK ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    resourcesDir: process.env.CARINA_RESOURCES_DIR ?? '',
    sessionTimeout: 60 * 60 * 1000,
    maxMemoryContext: 20,
    skillAutoWrite: process.env.SKILL_AUTO_WRITE !== 'false',
    llmMonthlyBudgetUsd: process.env.CARINA_LLM_MONTHLY_BUDGET_USD
      ? parseFloat(process.env.CARINA_LLM_MONTHLY_BUDGET_USD)
      : null,
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
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
    jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    appHost: process.env.CARINA_HOSTED_APP_HOST ?? 'app.carinaai.uk',
    operatorHosts: (process.env.CARINA_OPERATOR_HOSTS ?? 'core.carinaai.uk,localhost')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
    stripePrices: {
      scoutStandard: process.env.STRIPE_PRICE_SCOUT_STANDARD ?? '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    },
    freeDailyMessages: 100,
  },
  hub: {
    url: process.env.SKILLS_HUB_URL ?? 'https://skills.carinaai.uk',
    port: parseInt(process.env.SKILLS_HUB_PORT ?? '3001', 10),
    databaseUrl: process.env.SKILLS_HUB_DATABASE_URL ?? 'postgresql://localhost:5432/carina_skills_hub',
    publishApiKey: process.env.SKILLS_HUB_PUBLISH_KEY ?? '',
  },
  labyrinth: {
    enabled: process.env.LABYRINTH_ENABLED === 'true',
    url: process.env.LABYRINTH_URL ?? 'http://localhost:4444',
    apiKey: process.env.LABYRINTH_API_KEY ?? '',
    instanceId: process.env.LABYRINTH_INSTANCE_ID ?? 'carina-local',
    instanceName: process.env.LABYRINTH_INSTANCE_NAME ?? 'Carina Local',
    llmRouterUrl: process.env.LABYRINTH_LLM_ROUTER_URL ?? 'http://localhost:3000',
    judgeModel: process.env.LABYRINTH_JUDGE_MODEL ?? 'deepseek/deepseek-chat',
    judgeTimeoutMs: 3000,
  },
} as const;
