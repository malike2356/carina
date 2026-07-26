export type ConversationalChannelField = {
  key: string;
  label: string;
  help: string;
  placeholder: string;
  sensitive: boolean;
  optional?: boolean;
};

export type ConversationalChannelSetup = {
  channel: string;
  label: string;
  aliases: string[];
  fields: ConversationalChannelField[];
};

const field = (
  key: string,
  label: string,
  help: string,
  placeholder: string,
  sensitive = false,
  optional = false,
): ConversationalChannelField => ({ key, label, help, placeholder, sensitive, optional });

export const CONVERSATIONAL_CHANNEL_SETUPS: ConversationalChannelSetup[] = [
  {
    channel: 'telegram',
    label: 'Telegram',
    aliases: ['telegram', 'tg', 'botfather'],
    fields: [field('bot_token', 'Bot token', 'Copy the token supplied by @BotFather after creating your bot.', '123456789:ABC...', true)],
  },
  {
    channel: 'slack',
    label: 'Slack',
    aliases: ['slack'],
    fields: [
      field('bot_token', 'Bot token', 'Copy the Bot User OAuth Token from your Slack app.', 'xoxb-...', true),
      field('team_id', 'Workspace ID', 'Find the Workspace ID in About this workspace.', 'T01234567'),
    ],
  },
  {
    channel: 'whatsapp',
    label: 'WhatsApp Business',
    aliases: ['whatsapp business', 'whatsapp cloud', 'meta whatsapp'],
    fields: [
      field('access_token', 'Access token', 'Use a permanent system user token from Meta Business Manager.', 'Meta access token', true),
      field('phone_number_id', 'Phone number ID', 'Copy the Phone number ID, not the visible phone number.', '123456789012345'),
    ],
  },
  {
    channel: 'sms',
    label: 'SMS with Twilio',
    aliases: ['twilio', 'sms', 'text messages'],
    fields: [
      field('account_sid', 'Account SID', 'Copy your Account SID from the Twilio console.', 'AC...'),
      field('auth_token', 'Auth token', 'Copy the Auth Token shown beside your Account SID.', 'Twilio auth token', true),
      field('from_number', 'Twilio phone number', 'Enter your SMS-capable Twilio number with its country code.', '+447700900000'),
    ],
  },
  {
    channel: 'discord',
    label: 'Discord',
    aliases: ['discord'],
    fields: [field('bot_token', 'Bot token', 'Copy the token from the Bot section of the Discord developer portal.', 'Discord bot token', true)],
  },
  {
    channel: 'teams',
    label: 'Microsoft Teams',
    aliases: ['microsoft teams', 'ms teams', 'teams'],
    fields: [
      field('app_id', 'Microsoft App ID', 'Copy the Application (client) ID from your Azure bot registration.', 'Application ID'),
      field('app_password', 'Client secret', 'Copy the client secret value from Azure.', 'Client secret', true),
      field('tenant_id', 'Tenant ID', 'Optional for multi-tenant bots. Enter your Microsoft tenant ID when required.', 'Tenant ID (optional)', false, true),
    ],
  },
  {
    channel: 'web',
    label: 'Web chat',
    aliases: ['web chat', 'website chat', 'chat widget'],
    fields: [],
  },
];

const SETUP_INTENT = /\b(connect|configure|set\s*up|setup|add|enable|link|start|use|integrate)\b/i;
const NEGATIVE_INTENT = /\b(disconnect|remove|delete|disable|stop)\b/i;

export function detectConversationalChannelSetup(message: string): ConversationalChannelSetup | null {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized || !SETUP_INTENT.test(normalized) || NEGATIVE_INTENT.test(normalized)) return null;
  return CONVERSATIONAL_CHANNEL_SETUPS.find((setup) =>
    setup.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(normalized);
    })) ?? null;
}
