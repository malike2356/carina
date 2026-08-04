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

export const CONVERSATIONAL_CHANNEL_SETUPS: ConversationalChannelSetup[] = [
  {
    channel: 'telegram',
    label: 'Telegram',
    aliases: ['telegram', 'tg', 'botfather'],
    fields: [
      {
        key: 'bot_token',
        label: 'Bot token',
        help: 'Copy the token supplied by @BotFather after creating your bot.',
        placeholder: '123456789:ABC...',
        sensitive: true,
      },
    ],
  },
  {
    channel: 'slack',
    label: 'Slack',
    aliases: ['slack'],
    fields: [
      {
        key: 'bot_token',
        label: 'Bot token',
        help: 'Copy the Bot User OAuth Token from your Slack app.',
        placeholder: 'xoxb-...',
        sensitive: true,
      },
      {
        key: 'team_id',
        label: 'Workspace ID',
        help: 'Find the Workspace ID in About this workspace.',
        placeholder: 'T01234567',
        sensitive: false,
      },
    ],
  },
  {
    channel: 'whatsapp',
    label: 'WhatsApp Business',
    aliases: ['whatsapp business', 'whatsapp cloud', 'meta whatsapp'],
    fields: [
      {
        key: 'access_token',
        label: 'Access token',
        help: 'Use a permanent system user token from Meta Business Manager.',
        placeholder: 'Meta access token',
        sensitive: true,
      },
      {
        key: 'phone_number_id',
        label: 'Phone number ID',
        help: 'Copy the Phone number ID, not the visible phone number.',
        placeholder: '123456789012345',
        sensitive: false,
      },
    ],
  },
  {
    channel: 'sms',
    label: 'SMS with Twilio',
    aliases: ['twilio', 'sms', 'text messages'],
    fields: [
      {
        key: 'account_sid',
        label: 'Account SID',
        help: 'Copy your Account SID from the Twilio console.',
        placeholder: 'AC...',
        sensitive: false,
      },
      {
        key: 'auth_token',
        label: 'Auth token',
        help: 'Copy the Auth Token shown beside your Account SID.',
        placeholder: 'Twilio auth token',
        sensitive: true,
      },
      {
        key: 'from_number',
        label: 'Twilio phone number',
        help: 'Enter your SMS-capable Twilio number with its country code.',
        placeholder: '+447700900000',
        sensitive: false,
      },
    ],
  },
  {
    channel: 'discord',
    label: 'Discord',
    aliases: ['discord'],
    fields: [
      {
        key: 'bot_token',
        label: 'Bot token',
        help: 'Copy the token from the Bot section of the Discord developer portal.',
        placeholder: 'Discord bot token',
        sensitive: true,
      },
    ],
  },
  {
    channel: 'teams',
    label: 'Microsoft Teams',
    aliases: ['microsoft teams', 'ms teams', 'teams'],
    fields: [
      {
        key: 'app_id',
        label: 'Microsoft App ID',
        help: 'Copy the Application (client) ID from your Azure bot registration.',
        placeholder: 'Application ID',
        sensitive: false,
      },
      {
        key: 'app_password',
        label: 'Client secret',
        help: 'Copy the client secret value from Azure.',
        placeholder: 'Client secret',
        sensitive: true,
      },
      {
        key: 'tenant_id',
        label: 'Tenant ID',
        help: 'Optional for multi-tenant bots. Enter your Microsoft tenant ID when required.',
        placeholder: 'Tenant ID (optional)',
        sensitive: false,
        optional: true,
      },
    ],
  },
  {
    channel: 'web',
    label: 'Web chat',
    aliases: ['web chat', 'website chat', 'chat widget'],
    fields: [],
  },
];

const SETUP_INTENT =
  /\b(connect|configure|set\s*up|setup|add|enable|link|start|use|integrate)\b/i;
const NEGATIVE_INTENT = /\b(disconnect|remove|delete|disable|stop)\b/i;

export function detectConversationalChannelSetup(
  message: string,
): ConversationalChannelSetup | null {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized || !SETUP_INTENT.test(normalized) || NEGATIVE_INTENT.test(normalized)) {
    return null;
  }

  return (
    CONVERSATIONAL_CHANNEL_SETUPS.find((setup) =>
      setup.aliases.some((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(normalized);
      }),
    ) ?? null
  );
}
