import 'dotenv/config';

function require(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}. See .env.example.`);
  }
  return val;
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

const operatorApiKey = require('SCOUT_API_KEY');

export const config = {
  port: parseInt(optional('SCOUT_PORT', '4444'), 10),
  db: {
    url:
      optional('SCOUT_DATABASE_URL') ||
      optional('DATABASE_URL') ||
      'postgresql://carina:secret@localhost:5433/carina_central',
  },
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },
  auth: {
    apiKey: operatorApiKey,
    provisionSecret: optional('SCOUT_PROVISION_SECRET', operatorApiKey),
    sessionSecret: optional('SCOUT_SESSION_SECRET', 'change-me-in-production'),
    totpSecret: optional('SCOUT_TOTP_SECRET'),
    ipWhitelist: optional('SCOUT_IP_WHITELIST')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
    sessionTimeoutMs: parseInt(optional('SCOUT_SESSION_TIMEOUT_MS', String(30 * 60 * 1000)), 10),
  },
  trust: {
    publicEnabled: optional('TRUST_PUBLIC_ENABLED', 'true') !== 'false',
    erc8004Status: optional('TRUST_ERC8004_STATUS', 'registering'),
    erc8126Status: optional('TRUST_ERC8126_STATUS', 'enterprise'),
    chainId: parseInt(optional('TRUST_CHAIN_ID', '84532'), 10),
    chainRpc: optional('TRUST_CHAIN_RPC', 'https://sepolia.base.org'),
    attesterPrivateKey: optional('TRUST_ATTESTER_PRIVATE_KEY'),
    erc8004Registry: optional('TRUST_ERC8004_REGISTRY'),
    platform: optional('TRUST_PLATFORM', 'agent-trust-on-base'),
    attestationEnabled: optional('TRUST_ATTESTATION_ENABLED', 'true') !== 'false',
    attestationIntervalDays: parseInt(optional('TRUST_ATTESTATION_INTERVAL_DAYS', '7'), 10),
    subjectAgentWallet: optional('TRUST_SUBJECT_AGENT_WALLET'),
    verificationEnabled: optional('TRUST_VERIFICATION_ENABLED', 'true') !== 'false',
    verificationIntervalDays: parseInt(optional('TRUST_VERIFICATION_INTERVAL_DAYS', '7'), 10),
    wavEndpoints: optional(
      'TRUST_WAV_ENDPOINTS',
      'https://core.carinaai.uk,https://console.labyrinthscout.com/api/public/trust',
    )
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    erc8126ValidationRegistry: optional('TRUST_ERC8126_VALIDATION_REGISTRY'),
  },
  alerts: {
    telegram: {
      botToken: optional('TELEGRAM_BOT_TOKEN'),
      chatId: optional('TELEGRAM_CHAT_ID'),
    },
    email: {
      resendApiKey: optional('RESEND_API_KEY'),
      from: optional('ALERT_EMAIL_FROM', 'scout@verlox.co.uk'),
      to: optional('ALERT_EMAIL_TO'),
    },
    slack: {
      webhookUrl: optional('SLACK_WEBHOOK_URL'),
    },
  },
} as const;
