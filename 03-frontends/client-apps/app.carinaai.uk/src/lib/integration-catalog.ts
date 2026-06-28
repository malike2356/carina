export type IntegrationGroupId = 'messaging' | 'productivity' | 'devices';

export type IntegrationKind = 'aiva' | 'workspace';

export type IntegrationStatusKey = 'trello' | 'calendar' | 'pairing' | `aiva:${string}`;

export interface IntegrationDef {
  slug: string;
  label: string;
  description: string;
  group: IntegrationGroupId;
  groupLabel: string;
  kind: IntegrationKind;
  iconName: string;
  available: boolean;
  configureHref: string;
  statusKey?: IntegrationStatusKey;
  aivaChannelType?: string;
  setupSteps: string[];
}

export const INTEGRATION_GROUPS: Array<{ id: IntegrationGroupId; label: string }> = [
  { id: 'messaging', label: 'Messaging channels' },
  { id: 'productivity', label: 'Productivity and tools' },
  { id: 'devices', label: 'Devices and access' },
];

export const INTEGRATION_CATALOG: IntegrationDef[] = [
  {
    slug: 'slack',
    label: 'Slack',
    description: 'Direct-message your Aiva workers from a Slack workspace.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Hash',
    available: true,
    configureHref: '/channels/slack',
    statusKey: 'aiva:slack',
    aivaChannelType: 'slack',
    setupSteps: [
      'Create a Slack app at api.slack.com.',
      'Add bot scopes: chat:write, im:history, im:read, im:write, users:read.',
      'Set the event subscription URL to https://core.carinaai.uk/api/channels/webhook/slack',
      'Subscribe to message.im, install the app, then connect each Aiva below.',
    ],
  },
  {
    slug: 'whatsapp',
    label: 'WhatsApp',
    description: 'Business API messaging for tenant and buyer enquiries.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'MessageCircle',
    available: true,
    configureHref: '/channels/whatsapp',
    statusKey: 'aiva:whatsapp',
    aivaChannelType: 'whatsapp',
    setupSteps: [
      'Create a Meta Business app and add the WhatsApp product.',
      'Webhook URL: https://core.carinaai.uk/api/channels/webhook/whatsapp',
      'Save access token and phone number ID when connecting each Aiva.',
    ],
  },
  {
    slug: 'telegram',
    label: 'Telegram',
    description: 'Telegram bot conversations for each Aiva worker.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Send',
    available: true,
    configureHref: '/channels/telegram',
    statusKey: 'aiva:telegram',
    aivaChannelType: 'telegram',
    setupSteps: [
      'Create a bot via @BotFather and copy the bot token.',
      'Connect the token per Aiva; core registers the webhook automatically.',
    ],
  },
  {
    slug: 'email',
    label: 'Email',
    description: 'Dedicated @mail.carinaai.uk addresses per Aiva for inbound and reply.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Mail',
    available: true,
    configureHref: '/channels/email',
    statusKey: 'aiva:email',
    aivaChannelType: 'email',
    setupSteps: [
      'Connect email on an Aiva to receive a dedicated mail.carinaai.uk address.',
      'Share that address with clients; replies are sent from the same inbox.',
    ],
  },
  {
    slug: 'web',
    label: 'Web chat',
    description: 'Embed the Aiva widget on your site for live visitor chat.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Globe',
    available: true,
    configureHref: '/channels/web',
    statusKey: 'aiva:web',
    aivaChannelType: 'web',
    setupSteps: [
      'Enable web chat on an Aiva worker (no credentials required).',
      'Copy the embed snippet from the worker Channels tab.',
    ],
  },
  {
    slug: 'sms',
    label: 'SMS (Twilio)',
    description: 'Text message conversations via Twilio for each Aiva worker.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Phone',
    available: true,
    configureHref: '/channels/sms',
    statusKey: 'aiva:sms',
    aivaChannelType: 'sms',
    setupSteps: [
      'Create a Twilio account and buy an SMS-capable phone number.',
      'Set the Twilio webhook URL to https://core.carinaai.uk/api/channels/webhook/sms (HTTP POST).',
      'Connect account SID, auth token, and from number for each Aiva below.',
    ],
  },
  {
    slug: 'discord',
    label: 'Discord',
    description: 'Discord server and DM routing for Aiva workers.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'MessageSquare',
    available: true,
    configureHref: '/channels/discord',
    statusKey: 'aiva:discord',
    aivaChannelType: 'discord',
    setupSteps: [
      'Create a Discord application at discord.com/developers and add a bot.',
      'Enable Message Content Intent and Direct Messages in the bot settings.',
      'Paste the bot token below; Carina starts the gateway when you connect.',
    ],
  },
  {
    slug: 'teams',
    label: 'Microsoft Teams',
    description: 'Teams bot and channel routing for enterprise workspaces.',
    group: 'messaging',
    groupLabel: 'Messaging channels',
    kind: 'aiva',
    iconName: 'Users',
    available: true,
    configureHref: '/channels/teams',
    statusKey: 'aiva:teams',
    aivaChannelType: 'teams',
    setupSteps: [
      'Register an Azure Bot and note the Microsoft App ID and client secret.',
      'Messaging endpoint: https://core.carinaai.uk/api/channels/webhook/teams/{your-app-id}',
      'Connect app ID and password for each Aiva below.',
    ],
  },
  {
    slug: 'trello',
    label: 'Trello',
    description: 'Boards, lists, and cards plus the agent trello tool.',
    group: 'productivity',
    groupLabel: 'Productivity and tools',
    kind: 'workspace',
    iconName: 'LayoutList',
    available: true,
    configureHref: '/channels/trello',
    statusKey: 'trello',
    setupSteps: [
      'Get your API key and token at trello.com/app-key.',
      'Save credentials on the Trello channel page, then browse boards in the same view.',
    ],
  },
  {
    slug: 'calendar',
    label: 'Calendar sync',
    description: 'Google Calendar API or CalDAV for scheduling and events.',
    group: 'productivity',
    groupLabel: 'Productivity and tools',
    kind: 'workspace',
    iconName: 'CalendarDays',
    available: true,
    configureHref: '/channels/calendar',
    statusKey: 'calendar',
    setupSteps: [
      'Google Calendar: create an OAuth client, enable Calendar API, then connect or paste a refresh token.',
      'CalDAV: enter server URL, username, and app password for Nextcloud or similar.',
      'Test the connection, then sync events from the Calendar page.',
    ],
  },
  {
    slug: 'pairing',
    label: 'Device pairing',
    description: 'Link phones and tablets to this workspace with a QR code.',
    group: 'devices',
    groupLabel: 'Devices and access',
    kind: 'workspace',
    iconName: 'Smartphone',
    available: true,
    configureHref: '/settings/pairing',
    statusKey: 'pairing',
    setupSteps: [
      'Open pairing settings and scan the QR code from your mobile device.',
    ],
  },
];

export function getIntegration(slug: string): IntegrationDef | undefined {
  return INTEGRATION_CATALOG.find((item) => item.slug === slug);
}

export function integrationsByGroup(groupId: IntegrationGroupId): IntegrationDef[] {
  return INTEGRATION_CATALOG.filter((item) => item.group === groupId);
}
