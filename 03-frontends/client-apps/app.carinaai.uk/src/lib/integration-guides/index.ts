import type { IntegrationGuide, IntegrationGuideId } from './types';
import {
  GOOGLE_CLOUD_APIS_URL,
  GOOGLE_CLOUD_CONSENT_URL,
  GOOGLE_CLOUD_CREDENTIALS_URL,
  asCopyItems,
  currentAppOrigin,
  googleJsOrigins,
  googleRedirectUris,
} from './google-oauth';
import { VAULT_TOOL_GUIDES } from './vault-tools';
import {
  buildCaldavGuide,
  buildImapGuide,
  buildLinkedInGuide,
  buildMetaSocialGuide,
  buildTeamsGuide,
  buildTikTokGuide,
  buildTwitterGuide,
  buildVoiceGuide,
} from './channels-extra';

export type { IntegrationGuide, IntegrationGuideId, GuideStep, GuideCopyItem } from './types';

/**
 * Shared Hire Aiva / Carina redirect URIs already live on the platform Google OAuth client.
 * Normal users never paste these; they only pick their Google account and approve access.
 * BYOK (own Google Cloud client) is optional and gets the Console steps below.
 */
function googlePlatformConnectSteps(opts: {
  what: string;
  finishTitle: string;
  finishBody: string;
  finishLinks?: IntegrationGuide['steps'][number]['links'];
  finishTip?: string;
}): IntegrationGuide['steps'] {
  return [
    {
      title: 'Skip Google Cloud setup',
      body:
        'Hire Aiva uses a company Verlox platform Google app with the shared callback URLs already registered '
        + '(sign-in, Drive/tools, Gmail, Calendar, YouTube). You do not create a Google Cloud project '
        + 'or paste redirect URIs for the normal path. Those URLs are the same for every customer.',
      tip:
        'Only use Advanced (your own Google Cloud client) below if your organisation must issue tokens '
        + 'from its own Google Cloud project (BYOK). Most people never need that.',
    },
    {
      title: 'Click Connect with Google',
      body:
        `In Carina, click Connect with Google for ${opts.what}. Google opens. Pick the Google account you want Aiva to use, then Allow the access Google lists.`,
      tip:
        'Aiva never sees your Google password. Google returns a secure token for that account only.',
    },
    {
      title: opts.finishTitle,
      body: opts.finishBody,
      links: opts.finishLinks,
      tip: opts.finishTip,
    },
  ];
}

function googleOwnClientAdvancedSteps(opts: {
  apis: string;
  redirectUrls: string[];
  redirectLabel: string;
  alsoAddAll?: boolean;
}): IntegrationGuide['steps'] {
  const origin = currentAppOrigin();
  const all = googleRedirectUris(origin);
  const origins = googleJsOrigins(origin);
  const redirectCopy = asCopyItems(opts.redirectUrls, opts.redirectLabel);
  const allCopy = opts.alsoAddAll
    ? asCopyItems(all.all, 'URI')
    : redirectCopy;

  return [
    {
      title: 'Advanced only: open your Google Cloud project',
      body:
        'Skip this whole Advanced section unless you must use your own Google Cloud OAuth client. '
        + 'Open credentials in the Google Cloud project that you own. Create a project first if needed.',
      links: [
        { label: 'Open Google Cloud credentials', href: GOOGLE_CLOUD_CREDENTIALS_URL },
      ],
      tip: 'Do not paste these URIs into someone else\'s Google Cloud project. Platform customers use Connect with Google above instead.',
    },
    {
      title: 'Advanced: turn on Google APIs',
      body: `In the API Library, Enable: ${opts.apis}.`,
      links: [
        { label: 'Open API Library', href: GOOGLE_CLOUD_APIS_URL },
      ],
    },
    {
      title: 'Advanced: consent screen and Test users (403 fix)',
      body:
        'On YOUR OAuth consent screen, if Publishing status is Testing, add every Google email that will connect as a Test user, then Save. '
        + 'Or Publish app to Production on your project. Missing Test users cause Error 403: access_denied.',
      links: [
        { label: 'Open OAuth consent screen', href: GOOGLE_CLOUD_CONSENT_URL },
      ],
    },
    {
      title: 'Advanced: create a Web client and paste shared redirect URIs',
      body:
        'Create credentials → OAuth client ID → Web application. Under Authorized redirect URIs, paste each URI below. '
        + 'These URLs are identical for every Hire Aiva workspace; Google still requires them on whichever Client ID you create.',
      copyItems: allCopy,
      tip: 'Same list for every customer. The unique part is your Client ID, Client secret, and Test users on your project.',
      links: [
        { label: 'Open credentials', href: GOOGLE_CLOUD_CREDENTIALS_URL },
      ],
    },
    {
      title: 'Advanced: JavaScript origins',
      body: 'Under Authorized JavaScript origins, add these site addresses (no path).',
      copyItems: asCopyItems(origins, 'Origin'),
    },
    {
      title: 'Advanced: paste Client ID and secret into Carina',
      body:
        'Copy the Client ID and Client secret. For Calendar BYOK, paste them under Calendar settings, then Connect with Google. '
        + 'Do not load a customer\'s Client ID into platform Ops Google OAuth unless you intend every workspace to use that client.',
      tip: 'Never share the Client secret in chat or email.',
    },
  ];
}

function buildGoogleDriveGuide(): IntegrationGuide {
  const { tools } = googleRedirectUris();
  return {
    id: 'google-drive',
    title: 'Connect Google Drive',
    subtitle: 'Click Connect with Google and pick your Drive account. No Google Cloud project needed.',
    estimatedMinutes: 3,
    steps: [
      ...googlePlatformConnectSteps({
        what: 'Drive',
        finishTitle: 'Grant Drive to your Aiva',
        finishBody:
          'After Google says access granted, return here and Grant the connected account to the Aiva that needs Drive.',
        finishLinks: [
          { label: 'Open Tool accounts', href: '/aiva/tools?tool=google-drive' },
        ],
      }),
      ...googleOwnClientAdvancedSteps({
        apis: 'Google Drive API',
        redirectUrls: tools,
        redirectLabel: 'Drive / tools URI',
        alsoAddAll: true,
      }),
    ],
    finish:
      'Normal path: Connect → pick account → Allow → Grant. Only use Advanced if your org requires its own Google Cloud client.',
  };
}

function buildGoogleGmailGuide(): IntegrationGuide {
  const { gmail } = googleRedirectUris();
  return {
    id: 'google-gmail',
    title: 'Connect Gmail',
    subtitle: 'Click Connect Gmail and pick the mailbox. No Google Cloud project needed.',
    estimatedMinutes: 3,
    steps: [
      ...googlePlatformConnectSteps({
        what: 'Gmail',
        finishTitle: 'Sync the mailbox',
        finishBody:
          'On Email, click Reconnect Gmail (or Connect Gmail), pick the mailbox, Allow access, then Sync if mail does not appear yet.',
        finishTip:
          'If the banner mentions Gmail API is not enabled on a Google Cloud project, that is a platform ops fix: enable Gmail API (and Drive API if Drive fails) on the company Verlox project, wait about a minute, then Sync or Reconnect again.',
      }),
      ...googleOwnClientAdvancedSteps({
        apis: 'Gmail API',
        redirectUrls: gmail,
        redirectLabel: 'Gmail URI',
        alsoAddAll: true,
      }),
    ],
    finish:
      'Normal path: Reconnect Gmail → pick mailbox → Allow → Sync. Skip Advanced unless you bring your own Google Cloud client.',
  };
}

function buildGoogleCalendarGuide(): IntegrationGuide {
  const { calendar } = googleRedirectUris();
  return {
    id: 'google-calendar',
    title: 'Connect Google Calendar',
    subtitle: 'Click Connect with Google. Paste your own Client ID only if you require BYOK.',
    estimatedMinutes: 3,
    steps: [
      ...googlePlatformConnectSteps({
        what: 'Calendar',
        finishTitle: 'Turn on sync',
        finishBody:
          'On Calendar settings, leave Client ID blank when platform Google is configured, click Connect with Google, Allow access, then turn on sync. Use Test connection if you want a quick check.',
        finishLinks: [
          { label: 'Open Calendar settings', href: '/settings/calendar' },
        ],
        finishTip:
          'Optional BYOK: paste your own Client ID and secret first, then Connect. That path needs the Advanced Google Cloud steps below.',
      }),
      ...googleOwnClientAdvancedSteps({
        apis: 'Google Calendar API',
        redirectUrls: calendar,
        redirectLabel: 'Calendar URI',
        alsoAddAll: true,
      }),
    ],
    finish:
      'Normal path: Connect with Google on Calendar settings. Advanced is only for organisations that must use their own OAuth client.',
  };
}

function buildGoogleToolsGuide(): IntegrationGuide {
  const { all } = googleRedirectUris();
  return {
    id: 'google-tools',
    title: 'Connect Google tools',
    subtitle: 'One Connect with Google covers Drive, Gmail, Calendar tools, Contacts, Sheets, and Tasks.',
    estimatedMinutes: 4,
    steps: [
      ...googlePlatformConnectSteps({
        what: 'Google tools',
        finishTitle: 'Grant to each Aiva that needs Google',
        finishBody:
          '1) Connect with Google on Tool accounts. 2) Grant that account to each Aiva that needs it. '
          + '3) Calendar workspace sync: open Calendar settings and Connect there too (no Client ID paste on the normal path).',
        finishLinks: [
          { label: 'Tool accounts', href: '/aiva/tools' },
          { label: 'Calendar settings', href: '/settings/calendar' },
        ],
      }),
      ...googleOwnClientAdvancedSteps({
        apis:
          'Google Drive API, Gmail API, Google Calendar API, Google People API (Contacts), Google Sheets API, Google Tasks API',
        redirectUrls: all,
        redirectLabel: 'URI',
        alsoAddAll: true,
      }),
    ],
    finish:
      'Shared callback URLs stay on the company Verlox platform Google app. You only approve access for your Google account.',
  };
}

function buildTelegramGuide(): IntegrationGuide {
  return {
    id: 'telegram',
    title: 'Connect Telegram',
    subtitle: 'Create a bot with BotFather, copy the token, paste it here, then message the bot once.',
    estimatedMinutes: 6,
    steps: [
      {
        title: 'Open Telegram and find BotFather',
        body:
          'On your phone or desktop Telegram, search for BotFather. Use the official account with a blue check. Tap Start if you have not chatted before.',
        links: [{ label: 'Open BotFather', href: 'https://t.me/BotFather' }],
      },
      {
        title: 'Create a bot',
        body:
          'Send /newbot. BotFather asks for a display name (example: Selorm). Then it asks for a username that must end in bot (example: selorm_office_bot). If the username is taken, try another.',
      },
      {
        title: 'Copy the bot token',
        body:
          'BotFather replies with a token that looks like 7123456789:AAH... Copy the entire token. Do not share it in public chats.',
        tip: 'If you lose the token, send /token to BotFather and pick your bot to revoke/reissue.',
      },
      {
        title: 'Paste into Carina',
        body:
          'Paste the token into Bot token on this Connect screen. Click Connect. Wait until the status shows Connected.',
      },
      {
        title: 'Message the bot once',
        body:
          'In Telegram, open your new bot (search its username) and send Hi. That first message lets Aiva know who you are.',
      },
    ],
    finish:
      'Done when the bot replies in Telegram. If it stays quiet, open the worker Channels tab and confirm Telegram shows Connected.',
  };
}

function buildWhatsappGuide(): IntegrationGuide {
  return {
    id: 'whatsapp',
    title: 'Connect WhatsApp',
    subtitle: 'Create a Meta WhatsApp app, copy Phone number ID and a permanent access token.',
    estimatedMinutes: 25,
    steps: [
      {
        title: 'Open Meta for Developers',
        body:
          'Sign in with the Meta account that owns (or can admin) your WhatsApp Business setup.',
        links: [{ label: 'Meta for Developers', href: 'https://developers.facebook.com/apps/' }],
      },
      {
        title: 'Create or open an app',
        body:
          'Create App → pick a type that supports WhatsApp, or open an existing Business app. Add the WhatsApp product if it is not already added.',
      },
      {
        title: 'Copy Phone number ID',
        body:
          'In WhatsApp → API Setup, find Phone number ID for your test or live number. Copy that ID (digits). Also note your WhatsApp Business Account ID if shown.',
      },
      {
        title: 'Create a permanent access token',
        body:
          'Temporary tokens expire quickly. Prefer a System User token in Meta Business Settings with WhatsApp permissions, or Meta\'s permanent token flow for your number. Copy the full access token.',
        tip: 'If Connect works once then dies later, you still have a temporary token. Replace it with a permanent one.',
      },
      {
        title: 'Paste into Carina',
        body:
          'On Connect WhatsApp, paste Access token and Phone number ID. Connect. Send a WhatsApp message to that number to test inbound.',
      },
    ],
    finish: 'Done when the channel shows Connected and a test inbound WhatsApp message appears.',
  };
}

function buildSlackGuide(): IntegrationGuide {
  return {
    id: 'slack',
    title: 'Connect Slack',
    subtitle: 'Create a Slack app, add bot scopes, install it, paste xoxb token and Team ID.',
    estimatedMinutes: 15,
    steps: [
      {
        title: 'Create a Slack app',
        body:
          'Open Slack API → Create New App → From scratch. Name it (example: Aiva). Choose the workspace where people will message the bot.',
        links: [{ label: 'Slack API apps', href: 'https://api.slack.com/apps' }],
      },
      {
        title: 'Add bot token scopes',
        body:
          'OAuth & Permissions → Bot Token Scopes. Add at least: chat:write, app_mentions:read, channels:history, channels:read, im:history, im:read, im:write, users:read. Add groups:* scopes if you use private channels.',
      },
      {
        title: 'Install to workspace',
        body:
          'Click Install to Workspace and Allow. Copy Bot User OAuth Token (starts with xoxb-).',
      },
      {
        title: 'Copy Team ID',
        body:
          'In Slack, open your workspace settings / browser URL, or in the API app Basic Information look for Team ID / Workspace ID (starts with T). Copy it.',
      },
      {
        title: 'Invite the bot',
        body:
          'In a channel, type /invite @YourBotName (or add the app from channel integrations).',
      },
      {
        title: 'Paste into Carina',
        body: 'Paste Bot token and Team ID on this Connect screen, then Connect.',
      },
    ],
    finish: 'Done when Connected shows and messaging the bot in Slack gets a reply.',
  };
}

function buildDiscordGuide(): IntegrationGuide {
  return {
    id: 'discord',
    title: 'Connect Discord',
    subtitle: 'Create a bot, enable Message Content Intent, invite it, paste the bot token.',
    estimatedMinutes: 15,
    steps: [
      {
        title: 'Create an application',
        body:
          'Open Discord Developer Portal → New Application. Name it Aiva. Open the Bot tab → Add Bot → Yes.',
        links: [
          { label: 'Discord Developer Portal', href: 'https://discord.com/developers/applications' },
        ],
      },
      {
        title: 'Enable Message Content Intent',
        body:
          'On the Bot page, under Privileged Gateway Intents, turn ON Message Content Intent. Save changes. Without this, Aiva cannot read what people type.',
      },
      {
        title: 'Copy the bot token',
        body:
          'Click Reset Token / View Token and copy it. Treat it like a password. If it leaks, reset it.',
      },
      {
        title: 'Invite the bot to your server',
        body:
          'OAuth2 → URL Generator. Check scope bot. Under Bot Permissions check Send Messages and Read Message History (add more if needed). Copy the generated URL, open it, pick your server, Authorize.',
      },
      {
        title: 'Paste into Carina',
        body: 'Paste the bot token into Connect Discord and click Connect.',
      },
    ],
    finish: 'Done when the bot shows online and replies in a server channel.',
  };
}

function buildSmsGuide(): IntegrationGuide {
  return {
    id: 'sms',
    title: 'Connect SMS (Twilio)',
    subtitle: 'Copy Account SID, Auth token, and an SMS From number; set the inbound webhook.',
    estimatedMinutes: 12,
    steps: [
      {
        title: 'Open Twilio Console',
        body:
          'Sign in. On the home page, copy Account SID and Auth Token (reveal first).',
        links: [{ label: 'Twilio Console', href: 'https://console.twilio.com/' }],
      },
      {
        title: 'Buy or pick a From number',
        body:
          'Phone Numbers → Manage → Active numbers (or Buy a number). Choose SMS-capable. Copy in E.164 form (example +447700900000).',
      },
      {
        title: 'Set the inbound SMS webhook',
        body:
          'Open the number → Messaging Configuration. For A message comes in, set Webhook POST to the URL below. Save.',
        copyItems: [
          {
            label: 'SMS webhook',
            value: 'https://core.carinaai.uk/api/channels/webhook/sms',
          },
        ],
      },
      {
        title: 'Paste into Carina',
        body: 'Paste Account SID, Auth token, and From number here, then Connect.',
      },
    ],
    finish: 'Done when a test SMS to the From number appears in Carina.',
  };
}

const BUILDERS = {
  'google-drive': buildGoogleDriveGuide,
  'google-gmail': buildGoogleGmailGuide,
  'google-calendar': buildGoogleCalendarGuide,
  'google-tools': buildGoogleToolsGuide,
  telegram: buildTelegramGuide,
  whatsapp: buildWhatsappGuide,
  slack: buildSlackGuide,
  discord: buildDiscordGuide,
  sms: buildSmsGuide,
  voice: buildVoiceGuide,
  teams: buildTeamsGuide,
  caldav: buildCaldavGuide,
  imap: buildImapGuide,
  linkedin: buildLinkedInGuide,
  'meta-social': buildMetaSocialGuide,
  twitter: buildTwitterGuide,
  tiktok: buildTikTokGuide,
  ...VAULT_TOOL_GUIDES,
} as Record<IntegrationGuideId, () => IntegrationGuide>;

export function getIntegrationGuide(id: IntegrationGuideId): IntegrationGuide {
  const builder = BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown integration guide: ${id}`);
  }
  return builder();
}

export function hasIntegrationGuide(id: string): id is IntegrationGuideId {
  return Object.prototype.hasOwnProperty.call(BUILDERS, id);
}

export function guideIdForChannel(channelType: string): IntegrationGuideId | null {
  const key = channelType.trim().toLowerCase();
  if (key === 'telegram') return 'telegram';
  if (key === 'whatsapp') return 'whatsapp';
  if (key === 'slack') return 'slack';
  if (key === 'discord') return 'discord';
  if (key === 'sms') return 'sms';
  if (key === 'voice') return 'voice';
  if (key === 'teams') return 'teams';
  if (key === 'email') return 'google-gmail';
  if (key === 'linkedin') return 'linkedin';
  if (key === 'instagram' || key === 'messenger') return 'meta-social';
  if (key === 'twitter') return 'twitter';
  if (key === 'tiktok') return 'tiktok';
  return null;
}

export function guideIdForGoogleTool(toolSlug: string): IntegrationGuideId {
  const slug = toolSlug.trim().toLowerCase();
  if (slug === 'google-drive') return 'google-drive';
  if (slug === 'gmail') return 'google-gmail';
  if (slug === 'google-calendar') return 'google-calendar';
  return 'google-tools';
}

/** Map a product-tool catalog slug to a Guide me drawer, if one exists. */
export function guideIdForTool(toolSlug: string): IntegrationGuideId | null {
  const slug = toolSlug.trim().toLowerCase();
  if (!slug || slug === 'browser') return null;

  if (
    slug.startsWith('google-')
    || slug === 'gmail'
  ) {
    return guideIdForGoogleTool(slug);
  }

  if (slug in VAULT_TOOL_GUIDES) {
    return slug as IntegrationGuideId;
  }

  if (hasIntegrationGuide(slug)) {
    return slug as IntegrationGuideId;
  }

  return null;
}
