import { loadCarinaEnv } from './load-env.js';

loadCarinaEnv();

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: 'claude-sonnet-4-6',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
  },
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/carina',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
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
    activePack: process.env.ACTIVE_SKILL_PACK ?? 'property-uk',
    sessionTimeout: 60 * 60 * 1000,
    maxMemoryContext: 20,
    skillAutoWrite: process.env.SKILL_AUTO_WRITE !== 'false',
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? '',
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
    stripePrices: {
      scoutStandard: process.env.STRIPE_PRICE_SCOUT_STANDARD ?? '',
      carinaBundle: process.env.STRIPE_PRICE_CARINA_BUNDLE ?? '',
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
