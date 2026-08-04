import type { IntegrationGuide } from './types';

export function buildTeamsGuide(): IntegrationGuide {
  return {
    id: 'teams',
    title: 'Connect Microsoft Teams',
    subtitle: 'Register an Azure Bot, create a secret, set the messaging endpoint, paste App ID into Carina.',
    estimatedMinutes: 25,
    steps: [
      {
        title: 'Sign in to Azure Portal',
        body:
          'Use a Microsoft account that can create resources in your Azure subscription (or ask an admin to do these steps with you).',
        links: [{ label: 'Azure Portal', href: 'https://portal.azure.com/' }],
      },
      {
        title: 'Create an Azure Bot',
        body:
          'Search for Azure Bot → Create. Pick a resource group and a display name (example: Aiva Teams). Create the bot. When finished, open the bot resource.',
      },
      {
        title: 'Copy the Microsoft App ID',
        body:
          'On the bot overview / Configuration page, copy Microsoft App ID (a GUID). Keep it in a note labelled App ID.',
      },
      {
        title: 'Create a client secret',
        body:
          'Open Certificates & secrets (or Manage Password / Configuration → Manage Password). Create a new client secret. Copy the Value immediately (not the Secret ID). Azure shows the value only once.',
        tip: 'If you leave the page without copying, create a new secret.',
      },
      {
        title: 'Set the messaging endpoint',
        body:
          'In Configuration, set Messaging endpoint to the URL below. Replace YOUR_APP_ID with the same Microsoft App ID you copied. Save.',
        copyItems: [
          {
            label: 'Endpoint template',
            value: 'https://core.carinaai.uk/api/channels/webhook/teams/{YOUR_APP_ID}',
            hint: 'Replace {YOUR_APP_ID} with your Microsoft App ID. No spaces.',
          },
        ],
      },
      {
        title: 'Enable the Teams channel',
        body:
          'Open Channels → Microsoft Teams → enable / open in Teams. Follow Microsoft prompts to add the bot to Teams.',
      },
      {
        title: 'Paste into Carina',
        body:
          'On Connect Teams, paste App ID, Client secret, and Tenant ID if Carina asks for it. Click Connect.',
        tip: 'App ID in Carina must match the App ID in the webhook URL.',
      },
    ],
    finish: 'Done when the channel shows Connected and a 1:1 chat with the bot in Teams gets a reply.',
  };
}

export function buildCaldavGuide(): IntegrationGuide {
  return {
    id: 'caldav',
    title: 'Connect CalDAV calendar',
    subtitle: 'Copy your CalDAV URL, username, and app password from your calendar host.',
    estimatedMinutes: 10,
    steps: [
      {
        title: 'Find your provider\'s CalDAV instructions',
        body:
          'Open your calendar host help (Fastmail, Nextcloud, Synology, iCloud CalDAV, and so on) and search for CalDAV. You need a calendar URL, not just the website login page.',
      },
      {
        title: 'Copy the CalDAV calendar URL',
        body:
          'It usually looks like https://caldav.example.com/.../calendars/you/default/. Copy the full https URL for the calendar you want.',
        tip: 'If sync fails, you may have copied the account root instead of a specific calendar path.',
      },
      {
        title: 'Use an app password when required',
        body:
          'If you use two-factor login, create an app-specific password in the provider security settings. Use that password here, not your normal login password.',
      },
      {
        title: 'Paste into Calendar settings',
        body:
          'In Carina, open Calendar settings → CalDAV. Paste URL, username (often your email), and password. Save, then Test connection.',
        links: [{ label: 'Calendar settings', href: '/settings/calendar' }],
      },
    ],
    finish: 'Done when Test connection shows your calendar name and events appear under Calendar.',
  };
}

export function buildImapGuide(): IntegrationGuide {
  return {
    id: 'imap',
    title: 'Connect email with IMAP',
    subtitle: 'Use host, port, email, and an app password when OAuth is not available.',
    estimatedMinutes: 12,
    steps: [
      {
        title: 'Confirm IMAP is allowed',
        body:
          'In your email provider settings, turn on IMAP access if there is a switch (Gmail: Settings → See all settings → Forwarding and POP/IMAP).',
      },
      {
        title: 'Copy IMAP host and port',
        body:
          'From the provider help page, copy IMAP host and port. Common values: imap.gmail.com port 993 (SSL), outlook.office365.com port 993.',
      },
      {
        title: 'Create an app password',
        body:
          'Gmail, Microsoft, and many hosts block normal passwords for IMAP. Create an app password in Google Account → Security, or Microsoft Account → Security, then copy that 16-character (or similar) password.',
        tip: 'If Connect fails with authentication error, you almost always need an app password.',
      },
      {
        title: 'Paste into Connect email',
        body:
          'Choose IMAP. Paste host, port 993 (unless your host says otherwise), username (full email address), and the app password. Connect.',
      },
      {
        title: 'Sync mail',
        body: 'Open Email in Carina and run Sync. Wait for folders to load.',
      },
    ],
    finish: 'Done when Inbox shows messages. If empty, re-check app password, host, and that IMAP is enabled.',
  };
}

export function buildLinkedInGuide(): IntegrationGuide {
  return {
    id: 'linkedin',
    title: 'Connect LinkedIn',
    subtitle: 'Prefer one-click OAuth. Use developer tokens only if OAuth is unavailable.',
    estimatedMinutes: 15,
    steps: [
      {
        title: 'Try Connect with LinkedIn first',
        body:
          'On the Connect LinkedIn screen, click Connect with LinkedIn if the button is enabled. Approve access in LinkedIn, then return to Carina. Stop here if that succeeds.',
      },
      {
        title: 'Only if OAuth fails: open Developers',
        body:
          'Open LinkedIn Developer Portal. Create an app (or open yours). You need a company page association for many products.',
        links: [
          { label: 'LinkedIn Developers', href: 'https://www.linkedin.com/developers/apps' },
        ],
      },
      {
        title: 'Request the products you need',
        body:
          'Under Products, request Sign In with LinkedIn and any messaging products your use case needs. Wait for approval when LinkedIn requires it.',
      },
      {
        title: 'Generate member tokens',
        body:
          'Complete the OAuth member token flow for your user. Copy Access token, Refresh token, and Member ID.',
      },
      {
        title: 'Paste Advanced fields in Carina',
        body:
          'Open Advanced on Connect LinkedIn. Paste Access token, Refresh token, Member ID, and webhook secret if you use webhooks. Connect.',
      },
    ],
    finish: 'Done when the channel shows Connected and a test DM can be received.',
  };
}

export function buildMetaSocialGuide(): IntegrationGuide {
  return {
    id: 'meta-social',
    title: 'Connect Instagram or Messenger',
    subtitle: 'Link a Facebook Page to Instagram, create a Meta app, copy Page token and IDs.',
    estimatedMinutes: 25,
    steps: [
      {
        title: 'Prepare Facebook Page + Instagram',
        body:
          'You need a Facebook Page connected to an Instagram professional (Business or Creator) account. Do that in Meta Business Suite / Instagram settings before developer steps.',
      },
      {
        title: 'Create or open a Meta app',
        body:
          'Open Meta for Developers → My Apps → Create App. Add Messenger and/or Instagram products to the app.',
        links: [
          { label: 'Meta for Developers', href: 'https://developers.facebook.com/apps/' },
        ],
      },
      {
        title: 'Connect your Page',
        body:
          'In Messenger settings, select / add the Facebook Page. Generate a Page access token for that Page. Prefer a long-lived token.',
      },
      {
        title: 'Copy IDs',
        body:
          'Copy Page ID (for Messenger). For Instagram, copy the Instagram business account ID linked to that Page. Keep them labelled.',
      },
      {
        title: 'Choose a verify token',
        body:
          'Invent a random verify string (example: aiva-meta-verify-7f3k). You will type the same string in Meta webhooks and in Carina.',
      },
      {
        title: 'Configure the webhook',
        body:
          'In Meta webhooks, set Callback URL to your Carina Meta webhook (from host docs or Channels help) and paste the same verify token. Subscribe to messages.',
      },
      {
        title: 'Paste into Carina',
        body:
          'Prefer OAuth if the button works. Otherwise open Advanced: paste Page access token, Page ID / Instagram ID, and verify token. Connect.',
      },
    ],
    finish: 'Done when a test DM to the Page or Instagram account appears in Carina.',
  };
}

export function buildTwitterGuide(): IntegrationGuide {
  return {
    id: 'twitter',
    title: 'Connect X / Twitter',
    subtitle: 'Create a developer app with the right permissions, then copy access tokens.',
    estimatedMinutes: 18,
    steps: [
      {
        title: 'Open the X Developer Portal',
        body:
          'Sign in with the X account you want Aiva to use. Apply for a developer project if prompted.',
        links: [
          { label: 'X Developer Portal', href: 'https://developer.x.com/en/portal/dashboard' },
        ],
      },
      {
        title: 'Create a project and app',
        body: 'Create a Project, then an App inside it. Name them clearly (example: Aiva).',
      },
      {
        title: 'Set app permissions',
        body:
          'Under User authentication settings / App permissions, enable Read and Write. Enable Direct Messages if Aiva should handle DMs. Save.',
      },
      {
        title: 'Create Access Token and Secret',
        body:
          'Open Keys and tokens. Generate Access Token and Access Token Secret for your user. Copy User ID if shown.',
        tip: 'Regenerating tokens breaks old connections. Update Carina after any regenerate.',
      },
      {
        title: 'Paste into Carina',
        body:
          'Prefer OAuth if available. Otherwise open Advanced and paste Access token, Access token secret, and User ID. Connect.',
      },
    ],
    finish: 'Done when Connected shows and a test post or DM works.',
  };
}

export function buildTikTokGuide(): IntegrationGuide {
  return {
    id: 'tiktok',
    title: 'Connect TikTok',
    subtitle: 'Register a TikTok developer app, finish OAuth, paste tokens and open_id.',
    estimatedMinutes: 20,
    steps: [
      {
        title: 'Open TikTok Developers',
        body: 'Sign in and create a developer account / app if you do not have one.',
        links: [{ label: 'TikTok Developers', href: 'https://developers.tiktok.com/' }],
      },
      {
        title: 'Create an app and request products',
        body:
          'Create an app. Request Login Kit and any messaging / content products your plan and region allow. Wait for approval when required.',
      },
      {
        title: 'Run OAuth for your creator account',
        body:
          'Complete TikTok\'s OAuth for the creator account Aiva should use. Copy access_token, refresh_token, and open_id from the token response.',
      },
      {
        title: 'Paste into Carina',
        body:
          'Open Advanced on Connect TikTok. Paste Access token, Open ID, and Refresh token. Connect.',
      },
    ],
    finish: 'Done when the channel shows Connected and a test interaction succeeds.',
  };
}

export function buildVoiceGuide(): IntegrationGuide {
  return {
    id: 'voice',
    title: 'Connect Voice (Twilio)',
    subtitle: 'Same Twilio account as SMS: SID, auth token, voice-capable number, voice webhook.',
    estimatedMinutes: 12,
    steps: [
      {
        title: 'Open Twilio Console',
        body:
          'Sign in. On the Console home page, copy Account SID and Auth Token (click show to reveal).',
        links: [{ label: 'Twilio Console', href: 'https://console.twilio.com/' }],
      },
      {
        title: 'Pick a voice-capable From number',
        body:
          'Phone Numbers → Manage → Active numbers. Choose a number with Voice enabled. Copy it in E.164 form (example +447700900000).',
      },
      {
        title: 'Point Voice webhook at Carina',
        body:
          'Open that number → Voice Configuration. For A call comes in, choose Webhook, HTTP POST, and paste the URL below. Save.',
        copyItems: [
          {
            label: 'Voice webhook',
            value: 'https://core.carinaai.uk/api/channels/webhook/voice',
          },
        ],
      },
      {
        title: 'Paste into Carina',
        body:
          'On Connect Voice, paste Account SID, Auth token, and From number. Click Connect.',
      },
    ],
    finish: 'Done when a test call to the From number is answered turn-by-turn by Aiva.',
  };
}
