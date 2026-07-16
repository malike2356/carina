export interface ChannelField {
  key: string;
  label: string;
  description: string;
  sensitive: boolean;
  optional: boolean;
  example?: string;
}

export interface ChannelRequirement {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  fields: ChannelField[];
  setupDocs?: string;
  /**
   * db: encrypt into channel_configurations and activate without restart when possible
   * env: still store encrypted copy for conversational recovery; may require restart
   *      on Carina server hosts.
   */
  credentialType: 'db' | 'env';
  requiresRestart?: boolean;
}

export const CHANNEL_REQUIREMENTS: ChannelRequirement[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    aliases: ['telegram', 'tg', 'tele'],
    description: 'Telegram bot via BotFather token',
    fields: [
      {
        key: 'bot_token',
        label: 'Bot token',
        description: 'Token from BotFather (/newbot). Format: 123456:ABCdef...',
        sensitive: true,
        optional: false,
        example: '123456789:AABBccddEEff...',
      },
    ],
    setupDocs: 'https://core.telegram.org/bots#botfather',
    credentialType: 'db',
  },
  {
    id: 'discord',
    name: 'Discord',
    aliases: ['discord', 'dc'],
    description: 'Discord bot via bot token and application',
    fields: [
      {
        key: 'bot_token',
        label: 'Bot token',
        description: 'Bot token from the Discord developer portal',
        sensitive: true,
        optional: false,
      },
      {
        key: 'application_id',
        label: 'Application ID',
        description: 'Application (client) ID from the developer portal',
        sensitive: false,
        optional: false,
        example: '1234567890123456789',
      },
      {
        key: 'guild_id',
        label: 'Guild ID (optional)',
        description: 'Server ID for slash command registration. Leave blank for global commands.',
        sensitive: false,
        optional: true,
      },
    ],
    setupDocs: 'https://discord.com/developers/docs/intro',
    credentialType: 'db',
  },
  {
    id: 'whatsapp_cloud',
    name: 'WhatsApp (Meta Cloud API)',
    aliases: ['whatsapp_cloud', 'whatsapp cloud', 'meta whatsapp', 'wa cloud', 'wac'],
    description: 'WhatsApp via Meta Cloud API (business account required)',
    fields: [
      {
        key: 'access_token',
        label: 'Access token',
        description: 'Meta permanent or system user access token',
        sensitive: true,
        optional: false,
      },
      {
        key: 'phone_number_id',
        label: 'Phone number ID',
        description: 'WhatsApp phone number ID from Meta Business Manager',
        sensitive: false,
        optional: false,
        example: '123456789012345',
      },
      {
        key: 'verify_token',
        label: 'Webhook verify token',
        description: 'Token you choose and set in Meta webhook config to verify requests',
        sensitive: true,
        optional: false,
      },
    ],
    setupDocs: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    credentialType: 'db',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp (Baileys bridge)',
    aliases: ['whatsapp', 'wa', 'whatsapp baileys'],
    description: 'WhatsApp via local Baileys/bridge connection',
    fields: [
      {
        key: 'bridge_enabled',
        label: 'Enable bridge',
        description: 'Set to "true" to enable the Baileys bridge',
        sensitive: false,
        optional: false,
        example: 'true',
      },
      {
        key: 'credentials_path',
        label: 'Credentials path (optional)',
        description: 'Path to existing Baileys credentials directory. Leave blank to start fresh.',
        sensitive: false,
        optional: true,
      },
    ],
    credentialType: 'env',
    requiresRestart: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    aliases: ['slack'],
    description: 'Slack bot via Socket Mode or webhook',
    fields: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot token',
        description: 'Bot user OAuth token (starts with xoxb-)',
        sensitive: true,
        optional: false,
        example: 'xoxb-...',
      },
      {
        key: 'SLACK_APP_TOKEN',
        label: 'App-level token',
        description: 'App-level token for Socket Mode (starts with xapp-)',
        sensitive: true,
        optional: false,
        example: 'xapp-...',
      },
      {
        key: 'SLACK_SIGNING_SECRET',
        label: 'Signing secret',
        description: 'Used to verify requests from Slack',
        sensitive: true,
        optional: false,
      },
    ],
    setupDocs: 'https://api.slack.com/apps',
    credentialType: 'env',
    requiresRestart: true,
  },
  {
    id: 'signal',
    name: 'Signal',
    aliases: ['signal'],
    description: 'Signal via signal-cli REST bridge',
    fields: [
      {
        key: 'phone',
        label: 'Phone number',
        description: 'Registered Signal phone number (E.164 format)',
        sensitive: false,
        optional: false,
        example: '+447700900000',
      },
      {
        key: 'signal_cli_url',
        label: 'signal-cli API URL',
        description: 'URL of the signal-cli REST API (e.g. http://localhost:8080)',
        sensitive: false,
        optional: false,
        example: 'http://localhost:8080',
      },
    ],
    credentialType: 'env',
    requiresRestart: true,
  },
  {
    id: 'matrix',
    name: 'Matrix',
    aliases: ['matrix', 'element'],
    description: 'Matrix chat via homeserver credentials',
    fields: [
      {
        key: 'homeserver',
        label: 'Homeserver URL',
        description: 'Matrix homeserver URL',
        sensitive: false,
        optional: false,
        example: 'https://matrix.org',
      },
      {
        key: 'user',
        label: 'User ID',
        description: 'Full Matrix user ID',
        sensitive: false,
        optional: false,
        example: '@bot:matrix.org',
      },
      {
        key: 'password',
        label: 'Password',
        description: 'Matrix account password',
        sensitive: true,
        optional: false,
      },
    ],
    credentialType: 'env',
    requiresRestart: true,
  },
  {
    id: 'email',
    name: 'Email (IMAP + SMTP)',
    aliases: ['email', 'mail', 'imap', 'smtp', 'e-mail'],
    description: 'Email via IMAP (receive) and SMTP (send). Both paths are first-class.',
    fields: [
      // IMAP (receive)
      {
        key: 'imap_host',
        label: 'IMAP host',
        description: 'IMAP server hostname',
        sensitive: false,
        optional: false,
        example: 'imap.gmail.com',
      },
      {
        key: 'imap_port',
        label: 'IMAP port',
        description: 'IMAP port (usually 993 for SSL)',
        sensitive: false,
        optional: false,
        example: '993',
      },
      {
        key: 'imap_user',
        label: 'IMAP username / address',
        description: 'Email address used to log in to IMAP',
        sensitive: false,
        optional: false,
        example: 'you@example.com',
      },
      {
        key: 'imap_password',
        label: 'IMAP password or app password',
        description: 'IMAP login password. Use an app password for Gmail/Outlook.',
        sensitive: true,
        optional: false,
      },
      // SMTP (send)
      {
        key: 'smtp_host',
        label: 'SMTP host',
        description: 'SMTP server hostname',
        sensitive: false,
        optional: false,
        example: 'smtp.gmail.com',
      },
      {
        key: 'smtp_port',
        label: 'SMTP port',
        description: 'SMTP port (usually 587 for STARTTLS or 465 for SSL)',
        sensitive: false,
        optional: false,
        example: '587',
      },
      {
        key: 'smtp_user',
        label: 'SMTP username',
        description: 'Usually the same as your email address',
        sensitive: false,
        optional: false,
        example: 'you@example.com',
      },
      {
        key: 'smtp_password',
        label: 'SMTP password or app password',
        description: 'SMTP login password. Can be the same app password as IMAP.',
        sensitive: true,
        optional: false,
      },
    ],
    credentialType: 'db',
  },
  {
    id: 'sms',
    name: 'SMS (Twilio)',
    aliases: ['sms', 'text', 'twilio'],
    description: 'SMS via Twilio',
    fields: [
      {
        key: 'account_sid',
        label: 'Account SID',
        description: 'Twilio account SID from console.twilio.com',
        sensitive: false,
        optional: false,
        example: 'AC...',
      },
      {
        key: 'auth_token',
        label: 'Auth token',
        description: 'Twilio auth token',
        sensitive: true,
        optional: false,
      },
      {
        key: 'from_number',
        label: 'From number',
        description: 'Twilio phone number to send from (E.164)',
        sensitive: false,
        optional: false,
        example: '+14155551234',
      },
    ],
    setupDocs: 'https://www.twilio.com/docs',
    credentialType: 'db',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    aliases: ['teams', 'ms teams', 'microsoft teams', 'msteams'],
    description: 'Microsoft Teams via Azure Bot Framework',
    fields: [
      {
        key: 'client_id',
        label: 'Azure client ID',
        description: 'Application (client) ID from Azure Active Directory',
        sensitive: false,
        optional: false,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'client_secret',
        label: 'Azure client secret',
        description: 'Client secret from Azure App registrations',
        sensitive: true,
        optional: false,
      },
      {
        key: 'tenant_id',
        label: 'Tenant ID',
        description: 'Azure AD tenant ID',
        sensitive: false,
        optional: false,
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
    ],
    setupDocs: 'https://learn.microsoft.com/en-us/azure/bot-service/',
    credentialType: 'env',
    requiresRestart: true,
  },
];

export function findChannelByAlias(input: string): ChannelRequirement | null {
  const normalized = input.toLowerCase().trim();
  return (
    CHANNEL_REQUIREMENTS.find(
      (ch) =>
        ch.id === normalized ||
        ch.aliases.some((a) => a.toLowerCase() === normalized),
    ) ?? null
  );
}

export function listChannelSummaries(): Array<{ id: string; name: string; aliases: string[] }> {
  return CHANNEL_REQUIREMENTS.map(({ id, name, aliases }) => ({ id, name, aliases }));
}

export function getRequiredFields(channelId: string): ChannelField[] {
  const ch = CHANNEL_REQUIREMENTS.find((c) => c.id === channelId);
  if (!ch) return [];
  return ch.fields.filter((f) => !f.optional);
}

export function getSensitiveFieldKeys(): Set<string> {
  const keys = new Set<string>();
  for (const ch of CHANNEL_REQUIREMENTS) {
    for (const field of ch.fields) {
      if (field.sensitive) keys.add(field.key);
    }
  }
  return keys;
}
