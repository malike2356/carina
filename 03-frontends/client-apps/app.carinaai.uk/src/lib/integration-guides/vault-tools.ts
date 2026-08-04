import type { GuideStep, IntegrationGuide, IntegrationGuideId } from './types';

function pasteIntoCarina(opts: {
  product: string;
  toolId: string;
  fields: string;
  tip?: string;
}): GuideStep {
  return {
    title: 'Paste into Carina and test',
    body:
      `Go to Tool accounts (or stay on this page if you are already there). Choose ${opts.product}. `
      + `${opts.fields} `
      + 'Click Create + probe. Wait for a green success. Then click Grant and pick the Aiva that should use this tool.',
    links: [
      {
        label: `Open ${opts.product} tool`,
        href: `/aiva/tools?tool=${encodeURIComponent(opts.toolId)}`,
      },
    ],
    tip: opts.tip ?? 'Never paste tokens into chat with Aiva. Only into this Tool accounts form.',
  };
}

function guide(opts: {
  id: IntegrationGuideId;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  steps: GuideStep[];
  finish: string;
}): IntegrationGuide {
  return opts;
}

export const VAULT_TOOL_GUIDES: Record<string, () => IntegrationGuide> = {
  hubspot: () =>
    guide({
      id: 'hubspot',
      title: 'Connect HubSpot',
      subtitle: 'Create a private app, copy the access token, paste it into Carina.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open HubSpot settings',
          body:
            'Sign in to HubSpot with the account that owns your CRM. Click the settings gear (top right).',
          links: [
            {
              label: 'HubSpot private apps help',
              href: 'https://developers.hubspot.com/docs/api/private-apps',
            },
          ],
        },
        {
          title: 'Open Private Apps',
          body:
            'In the left sidebar: Integrations → Private Apps. If you do not see Private Apps, you may need a Super Admin role.',
        },
        {
          title: 'Create a private app',
          body:
            'Click Create a private app. Name it something clear like Aiva CRM. On the Scopes tab, turn on at least crm.objects.contacts.read and crm.objects.contacts.write (add deals/companies if Aiva should use those too).',
          tip: 'If Connect + probe fails, click Clear stored credentials on the card, then paste a fresh private app token and probe again.',
        },
        {
          title: 'Copy the access token',
          body:
            'Click Create app, then Show token / Copy. The token is a long string. Copy the whole thing once; HubSpot may hide it later.',
        },
        pasteIntoCarina({
          product: 'HubSpot',
          toolId: 'hubspot',
          fields: 'Paste the access token into the API token / secret field.',
        }),
      ],
      finish:
        'Done when Create + probe is green and your Aiva can search a known HubSpot contact by name.',
    }),

  pipedrive: () =>
    guide({
      id: 'pipedrive',
      title: 'Connect Pipedrive',
      subtitle: 'Copy your personal API token from Pipedrive settings.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Open Pipedrive',
          body: 'Sign in to the Pipedrive company you want Aiva to use.',
          links: [
            { label: 'Pipedrive API settings', href: 'https://app.pipedrive.com/settings/api' },
          ],
        },
        {
          title: 'Open API settings',
          body:
            'Click your avatar (top right) → Personal preferences → API. Or open the API settings link above.',
        },
        {
          title: 'Copy your API token',
          body:
            'You will see Your personal API token. Click Copy or select the whole token and copy it. If your company uses company tokens instead, use the token your admin gave you.',
        },
        pasteIntoCarina({
          product: 'Pipedrive',
          toolId: 'pipedrive',
          fields: 'Paste the token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list or search a deal or person you know.',
    }),

  salesforce: () =>
    guide({
      id: 'salesforce',
      title: 'Connect Salesforce',
      subtitle: 'Usually needs a Connected App or admin-provided token. Follow carefully.',
      estimatedMinutes: 20,
      steps: [
        {
          title: 'Check if you are an admin',
          body:
            'Salesforce setup is harder than other tools. If you are not a Salesforce admin, ask your admin for: an access token (or Connected App credentials), your instance / My Domain URL (example: https://yourcompany.my.salesforce.com), and which user Aiva should act as.',
          links: [
            {
              label: 'Salesforce Connected Apps help',
              href: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm',
            },
          ],
          tip: 'Do not invent tokens. If Setup is missing from your menu, you need an admin.',
        },
        {
          title: 'If you are the admin: create a Connected App',
          body:
            'In Salesforce Setup, search App Manager → New Connected App. Enable OAuth settings. Add the API scopes your team needs. Save, then manage consumer key / secret or issue a token for an integration user.',
        },
        {
          title: 'Copy credentials into a safe note',
          body:
            'Write down: access token (or how Carina asks for it), instance / domain URL, and any client id / secret fields shown on the Carina form.',
        },
        pasteIntoCarina({
          product: 'Salesforce',
          toolId: 'salesforce',
          fields:
            'Paste the token, then fill every Salesforce field Carina shows (instance / domain, client fields if present).',
          tip: 'Wrong instance URL is the most common failure. Use your My Domain URL, not login.salesforce.com alone.',
        }),
      ],
      finish: 'Done when probe is green. If it fails, re-check instance URL and token with your admin.',
    }),

  stripe: () =>
    guide({
      id: 'stripe',
      title: 'Connect Stripe',
      subtitle: 'Copy a Secret API key (sk_...) from the Stripe Dashboard.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Open Stripe API keys',
          body:
            'Sign in to Stripe. Open Developers → API keys. Use Test mode keys while learning; Live mode keys for real money.',
          links: [{ label: 'Stripe API keys', href: 'https://dashboard.stripe.com/apikeys' }],
        },
        {
          title: 'Copy a Secret key',
          body:
            'Find Secret key. Click Reveal / Create secret key if needed. Copy a key that starts with sk_test_ or sk_live_. Do not copy a Publishable key (pk_...).',
          tip: 'Prefer a Restricted key with only the permissions Aiva needs (for example read customers / charges).',
        },
        pasteIntoCarina({
          product: 'Stripe',
          toolId: 'stripe',
          fields: 'Paste the sk_... key into the API token / secret field.',
          tip: 'pk_ keys will always fail. Only sk_ secret keys work here.',
        }),
      ],
      finish: 'Done when probe is green. Ask Aiva a safe read-only question about your Stripe account to confirm.',
    }),

  zendesk: () =>
    guide({
      id: 'zendesk',
      title: 'Connect Zendesk',
      subtitle: 'Create an API token and note your subdomain.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Zendesk Admin Center',
          body: 'Sign in to Zendesk as an admin. Open Admin Center.',
          links: [
            {
              label: 'Zendesk API token help',
              href: 'https://support.zendesk.com/hc/en-us/articles/4408889192858',
            },
          ],
        },
        {
          title: 'Turn on token access',
          body:
            'Go to Apps and integrations → APIs → Zendesk API. Enable Token access if it is off.',
        },
        {
          title: 'Add an API token',
          body:
            'Click Add API token. Give it a name like Aiva. Copy the token immediately (Zendesk shows it once).',
        },
        {
          title: 'Note your subdomain',
          body:
            'Look at your Zendesk URL. If you open https://acme.zendesk.com, your subdomain is acme. You will need that plus usually the admin email that owns the token.',
        },
        pasteIntoCarina({
          product: 'Zendesk',
          toolId: 'zendesk',
          fields:
            'Paste the API token. Fill subdomain (example: acme) and email if the form asks.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list or search a known ticket.',
    }),

  freshdesk: () =>
    guide({
      id: 'freshdesk',
      title: 'Connect Freshdesk',
      subtitle: 'Copy your API key and Freshdesk domain.',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Freshdesk profile settings',
          body: 'Sign in to Freshdesk. Click your profile picture → Profile settings.',
          links: [
            {
              label: 'Freshdesk API key help',
              href: 'https://support.freshdesk.com/support/solutions/articles/215517',
            },
          ],
        },
        {
          title: 'Copy Your API Key',
          body: 'On the profile page, find Your API Key and copy it.',
        },
        {
          title: 'Note your domain',
          body:
            'From the browser address bar, copy your host (example: yourcompany.freshdesk.com).',
        },
        pasteIntoCarina({
          product: 'Freshdesk',
          toolId: 'freshdesk',
          fields: 'Paste the API key and domain / subdomain fields Carina shows.',
        }),
      ],
      finish: 'Done when probe is green.',
    }),

  intercom: () =>
    guide({
      id: 'intercom',
      title: 'Connect Intercom',
      subtitle: 'Create a developer app access token with inbox scopes.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Intercom Developer Hub',
          body: 'Sign in to Intercom. Open the Developer Hub for your workspace.',
          links: [
            {
              label: 'Intercom getting started',
              href: 'https://developers.intercom.com/docs/build-an-integration/getting-started/',
            },
          ],
        },
        {
          title: 'Create or open an app',
          body: 'Create a new app (or open an existing one) for Aiva.',
        },
        {
          title: 'Copy an access token',
          body:
            'Open Authentication. Create / copy an access token. Include Messenger / inbox / contacts permissions you need.',
        },
        pasteIntoCarina({
          product: 'Intercom',
          toolId: 'intercom',
          fields: 'Paste the access token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can see a known Intercom contact or conversation.',
    }),

  'slack-tool': () =>
    guide({
      id: 'slack-tool',
      title: 'Connect Slack (tools)',
      subtitle: 'Create a Slack bot token for tool actions (separate from chat Channels if you want).',
      estimatedMinutes: 15,
      steps: [
        {
          title: 'Create a Slack app',
          body:
            'Open the Slack API site → Create New App → From scratch. Name it (example: Aiva Tools). Pick your workspace.',
          links: [{ label: 'Slack API apps', href: 'https://api.slack.com/apps' }],
        },
        {
          title: 'Add bot token scopes',
          body:
            'Open OAuth & Permissions. Under Bot Token Scopes, add at least: chat:write, channels:history, channels:read, users:read, and groups:history if you use private channels. Add more only if you need them.',
        },
        {
          title: 'Install the app',
          body:
            'Click Install to Workspace (or Reinstall). Approve the permissions. Copy Bot User OAuth Token. It starts with xoxb-.',
          tip: 'User tokens (xoxp-) are different. Carina expects the bot token (xoxb-).',
        },
        {
          title: 'Optional: invite the bot',
          body:
            'In Slack, open a channel → Integrations / Add apps → add your bot. Without this, channel reads can fail.',
        },
        pasteIntoCarina({
          product: 'Slack',
          toolId: 'slack-tool',
          fields: 'Paste the xoxb- token into the API token / secret field.',
          tip: 'Channels → Slack chat connect and Tools → Slack can share one bot, or use two apps.',
        }),
      ],
      finish: 'Done when probe is green. Ask Aiva to post a test message in a channel the bot can access.',
    }),

  notion: () =>
    guide({
      id: 'notion',
      title: 'Connect Notion',
      subtitle: 'Create an integration, copy the secret, then share pages with it.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Notion integrations',
          body: 'Sign in to Notion in a browser. Open My integrations.',
          links: [
            { label: 'Notion integrations', href: 'https://www.notion.so/my-integrations' },
          ],
        },
        {
          title: 'Create a new integration',
          body:
            'Click New integration. Name it Aiva. Choose the workspace that has your pages. Capabilities: read content (and update/insert if Aiva should edit). Submit.',
        },
        {
          title: 'Copy the Internal Integration Secret',
          body:
            'Open the integration → Secrets. Click Show / Copy next to Internal Integration Secret. It often starts with secret_ or ntn_.',
        },
        {
          title: 'Share pages or databases with the integration',
          body:
            'This step is required. Open each Notion page or database Aiva should see → ••• menu → Connect to / Connections → select your Aiva integration. If you skip this, the token looks valid but Aiva sees nothing.',
          tip: 'Share the parent page to include child pages, or share each database separately.',
        },
        pasteIntoCarina({
          product: 'Notion',
          toolId: 'notion',
          fields: 'Paste the Internal Integration Secret into the API token / secret field.',
        }),
      ],
      finish:
        'Done when probe is green AND Aiva can open a page you shared with the integration.',
    }),

  airtable: () =>
    guide({
      id: 'airtable',
      title: 'Connect Airtable',
      subtitle: 'Create a personal access token scoped to your bases.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Airtable token creator',
          body: 'Sign in to Airtable and open Create tokens.',
          links: [{ label: 'Create Airtable token', href: 'https://airtable.com/create/tokens' }],
        },
        {
          title: 'Create a token',
          body:
            'Click Create new token. Name it Aiva. Add scopes: data.records:read, data.records:write, and schema.bases:read if available.',
        },
        {
          title: 'Limit access to the right bases',
          body:
            'Under Access, add only the bases Aiva should use. Click Create token. Copy the token once (Airtable shows it only once).',
        },
        pasteIntoCarina({
          product: 'Airtable',
          toolId: 'airtable',
          fields: 'Paste the personal access token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list records from a shared base.',
    }),

  trello: () =>
    guide({
      id: 'trello',
      title: 'Connect Trello',
      subtitle: 'You need BOTH an API key and a token. Missing either one fails.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Power-Ups admin',
          body:
            'Sign in to Trello in a browser. Open Power-Ups admin (you may need to allow pop-ups).',
          links: [
            { label: 'Trello Power-Ups admin', href: 'https://trello.com/power-ups/admin' },
          ],
        },
        {
          title: 'Create or open a Power-Up',
          body:
            'Click New → Power-Up (or open an existing one). Give it a name like Aiva. You do not need to publish it to the marketplace.',
        },
        {
          title: 'Copy the API key',
          body:
            'Open the API key tab / page for that Power-Up. Copy the API key (a long hex string). Keep it in a note labelled API key.',
        },
        {
          title: 'Generate your user token',
          body:
            'On the same API key page, click the link to generate a Token (sometimes labelled Token or manually generate a Token). Approve access for your Trello account. Copy the token (another long string). Keep it labelled Token.',
          tip: 'API key ≠ Token. Carina needs both fields filled.',
        },
        pasteIntoCarina({
          product: 'Trello',
          toolId: 'trello',
          fields:
            'Paste Token into API token / secret. Paste API key into the apiKey field (or whichever field is labelled API key).',
        }),
      ],
      finish:
        'Done when probe is green. Ask Aiva to list boards; empty boards usually means the token user cannot see them.',
    }),

  asana: () =>
    guide({
      id: 'asana',
      title: 'Connect Asana',
      subtitle: 'Create a Personal Access Token for a user who can see your projects.',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Asana developer apps',
          body: 'Sign in to Asana. Open My apps / developer console.',
          links: [{ label: 'Asana my apps', href: 'https://app.asana.com/0/my-apps' }],
        },
        {
          title: 'Create a Personal Access Token',
          body:
            'Click Create new token (Personal Access Token). Name it Aiva. Copy the token once.',
          tip: 'Use a user who can already open the projects Aiva should manage.',
        },
        pasteIntoCarina({
          product: 'Asana',
          toolId: 'asana',
          fields: 'Paste the Personal Access Token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list tasks in a known project.',
    }),

  linear: () =>
    guide({
      id: 'linear',
      title: 'Connect Linear',
      subtitle: 'Create a Personal API key in Linear settings.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Open Linear API settings',
          body: 'Sign in to Linear. Open Settings → API.',
          links: [{ label: 'Linear API settings', href: 'https://linear.app/settings/api' }],
        },
        {
          title: 'Create a Personal API key',
          body:
            'Under Personal API keys, click Create key. Name it Aiva. Copy the key immediately (Linear shows it only once).',
        },
        pasteIntoCarina({
          product: 'Linear',
          toolId: 'linear',
          fields: 'Paste the API key into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list issues in your workspace.',
    }),

  jira: () =>
    guide({
      id: 'jira',
      title: 'Connect Jira Cloud',
      subtitle: 'Create an Atlassian API token; you also need email and site URL.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open Atlassian API tokens',
          body: 'Sign in with the Atlassian account that can open your Jira site.',
          links: [
            {
              label: 'Create API token',
              href: 'https://id.atlassian.com/manage-profile/security/api-tokens',
            },
          ],
        },
        {
          title: 'Create an API token',
          body: 'Click Create API token. Label it Aiva. Copy the token once.',
        },
        {
          title: 'Note email and site URL',
          body:
            'Write down: (1) the Atlassian email you used, (2) your Jira site URL like https://yourcompany.atlassian.net (no trailing path).',
        },
        pasteIntoCarina({
          product: 'Jira',
          toolId: 'jira',
          fields:
            'Paste the API token, your Atlassian email, and the site / base URL exactly as https://….atlassian.net.',
        }),
      ],
      finish: 'Done when probe is green. Wrong site URL or email is the usual failure.',
    }),

  github: () =>
    guide({
      id: 'github',
      title: 'Connect GitHub',
      subtitle: 'Create a personal access token limited to the repos Aiva needs.',
      estimatedMinutes: 12,
      steps: [
        {
          title: 'Open GitHub token settings',
          body:
            'Sign in to GitHub. Open Settings → Developer settings → Personal access tokens.',
          links: [
            { label: 'GitHub tokens', href: 'https://github.com/settings/tokens' },
          ],
        },
        {
          title: 'Prefer a fine-grained token',
          body:
            'Click Fine-grained tokens → Generate new token. Name it Aiva. Set an expiry you are comfortable with. Under Repository access, pick Only select repositories and choose the repos Aiva should touch.',
          tip: 'Classic tokens work too, but fine-grained is safer.',
        },
        {
          title: 'Pick permissions',
          body:
            'For normal code help: Contents Read and write, Metadata Read-only, Pull requests Read and write if needed. Add Administration only if you truly need it.',
        },
        {
          title: 'Generate and copy',
          body:
            'Click Generate token. Copy the token once (starts with github_pat_ for fine-grained, or ghp_ for classic).',
        },
        pasteIntoCarina({
          product: 'GitHub',
          toolId: 'github',
          fields: 'Paste the token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list issues or files in an allowed repo.',
    }),

  calendly: () =>
    guide({
      id: 'calendly',
      title: 'Connect Calendly',
      subtitle: 'Generate a personal access token (API access required on your plan).',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Calendly integrations',
          body:
            'Sign in to Calendly. Open Integrations / API & Webhooks. Your plan must include API access.',
          links: [
            {
              label: 'Calendly API & webhooks',
              href: 'https://calendly.com/integrations/api_webhooks',
            },
          ],
        },
        {
          title: 'Create a personal access token',
          body: 'Create / generate a personal access token. Copy it once into a safe note.',
        },
        pasteIntoCarina({
          product: 'Calendly',
          toolId: 'calendly',
          fields: 'Paste the token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green. If create token is missing, your Calendly plan may not include API.',
    }),

  mailchimp: () =>
    guide({
      id: 'mailchimp',
      title: 'Connect Mailchimp',
      subtitle: 'Create an API key; note the -usN data center suffix.',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Mailchimp API keys',
          body: 'Sign in to Mailchimp. Open Account → Extras → API keys.',
          links: [
            { label: 'Mailchimp API keys', href: 'https://admin.mailchimp.com/account/api/' },
          ],
        },
        {
          title: 'Create a key',
          body:
            'Click Create A Key. Copy the full key. The end looks like -us14 (your data center). Keep that whole string.',
        },
        pasteIntoCarina({
          product: 'Mailchimp',
          toolId: 'mailchimp',
          fields:
            'Paste the full API key. If Carina asks for server / dc, use the usN part after the dash.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can see an audience / list you expect.',
    }),

  beehiiv: () =>
    guide({
      id: 'beehiiv',
      title: 'Connect Beehiiv',
      subtitle: 'Create an API key and note your publication ID if asked.',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Beehiiv',
          body: 'Sign in to Beehiiv for the publication Aiva should manage.',
          links: [{ label: 'Beehiiv app', href: 'https://app.beehiiv.com/' }],
        },
        {
          title: 'Open Settings → Integrations / API',
          body:
            'Create an API key with access to that publication. Copy the key. Also copy Publication ID if Beehiiv shows it separately.',
        },
        pasteIntoCarina({
          product: 'Beehiiv',
          toolId: 'beehiiv',
          fields: 'Paste the API key and publication ID if the form asks for it.',
        }),
      ],
      finish: 'Done when probe is green.',
    }),

  shopify: () =>
    guide({
      id: 'shopify',
      title: 'Connect Shopify',
      subtitle: 'Create a custom app, install it, copy Admin API token and shop domain.',
      estimatedMinutes: 18,
      steps: [
        {
          title: 'Open Shopify admin',
          body: 'Sign in to the store you want Aiva to use (you need app development rights).',
          links: [
            {
              label: 'Shopify custom apps help',
              href: 'https://help.shopify.com/en/manual/apps/app-types/custom-apps',
            },
          ],
        },
        {
          title: 'Allow custom app development',
          body:
            'Settings → Apps and sales channels → Develop apps. If prompted, allow custom app development.',
        },
        {
          title: 'Create a custom app',
          body:
            'Click Create an app. Name it Aiva. Configure Admin API scopes you need (for example read_products, write_products, read_orders). Save.',
        },
        {
          title: 'Install and copy the Admin API access token',
          body:
            'Install the app. Reveal once and copy the Admin API access token (starts with shpat_). Also copy your shop domain: your-store.myshopify.com.',
          tip: 'The Admin API token is shown only once. Save it before closing the page.',
        },
        pasteIntoCarina({
          product: 'Shopify',
          toolId: 'shopify',
          fields: 'Paste the Admin API token and shop domain (your-store.myshopify.com).',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list products or orders from that shop.',
    }),

  supabase: () =>
    guide({
      id: 'supabase',
      title: 'Connect Supabase',
      subtitle: 'Copy Project URL and a key (prefer limited keys over service_role).',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open your Supabase project',
          body: 'Sign in to Supabase and open the project Aiva should use.',
          links: [{ label: 'Supabase dashboard', href: 'https://supabase.com/dashboard' }],
        },
        {
          title: 'Open Project Settings → API',
          body:
            'Copy Project URL. Then copy a key: prefer a restricted key if you have one. service_role bypasses Row Level Security and is powerful; only use it if you understand that risk.',
          tip: 'Never put service_role keys in public apps. Tool accounts on Carina are for trusted workspace use only.',
        },
        pasteIntoCarina({
          product: 'Supabase',
          toolId: 'supabase',
          fields: 'Paste the key into API token / secret and the Project URL into the URL field.',
        }),
      ],
      finish: 'Done when probe is green.',
    }),

  clickup: () =>
    guide({
      id: 'clickup',
      title: 'Connect ClickUp',
      subtitle: 'Copy your personal API token from ClickUp Apps settings.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Open ClickUp Apps settings',
          body: 'Sign in to ClickUp. Open Settings → Apps.',
          links: [
            { label: 'ClickUp Apps / API', href: 'https://app.clickup.com/settings/apps' },
          ],
        },
        {
          title: 'Copy API Token',
          body:
            'Find API Token. Click Generate if needed, then Copy. Use the account that can see the spaces Aiva should use.',
        },
        pasteIntoCarina({
          product: 'ClickUp',
          toolId: 'clickup',
          fields: 'Paste the personal API token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list tasks in a known list.',
    }),

  monday: () =>
    guide({
      id: 'monday',
      title: 'Connect Monday.com',
      subtitle: 'Copy a personal API token that can access your boards.',
      estimatedMinutes: 10,
      steps: [
        {
          title: 'Open Monday developers / tokens',
          body:
            'Sign in to Monday.com. Click your avatar → Developers → My access tokens (or Admin → API, depending on your plan).',
          links: [
            {
              label: 'Monday authentication docs',
              href: 'https://developer.monday.com/api-reference/docs/authentication',
            },
          ],
        },
        {
          title: 'Create or copy a token',
          body:
            'Create a personal API token (or copy an existing one). Make sure that user can open the boards Aiva should use.',
        },
        pasteIntoCarina({
          product: 'Monday.com',
          toolId: 'monday',
          fields: 'Paste the API token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can read a known board.',
    }),

  todoist: () =>
    guide({
      id: 'todoist',
      title: 'Connect Todoist',
      subtitle: 'Copy your developer API token from Todoist integrations.',
      estimatedMinutes: 6,
      steps: [
        {
          title: 'Open Todoist developer settings',
          body: 'Sign in to Todoist in a browser. Open Settings → Integrations → Developer.',
          links: [
            {
              label: 'Todoist developer integrations',
              href: 'https://todoist.com/app/settings/integrations/developer',
            },
          ],
        },
        {
          title: 'Copy the API token',
          body: 'Find API token and click Copy.',
        },
        pasteIntoCarina({
          product: 'Todoist',
          toolId: 'todoist',
          fields: 'Paste the API token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list your tasks.',
    }),

  dropbox: () =>
    guide({
      id: 'dropbox',
      title: 'Connect Dropbox',
      subtitle: 'Create a Dropbox app and generate an access token with the right scope.',
      estimatedMinutes: 15,
      steps: [
        {
          title: 'Open Dropbox App Console',
          body: 'Sign in and open the App Console.',
          links: [
            { label: 'Dropbox App Console', href: 'https://www.dropbox.com/developers/apps' },
          ],
        },
        {
          title: 'Create an app',
          body:
            'Click Create app. Choose Scoped access. Pick App folder (safer, only one folder) or Full Dropbox (broader). Name the app Aiva.',
        },
        {
          title: 'Set permissions',
          body:
            'Open Permissions. Enable files.content.read and files.content.write (and sharing if needed). Submit.',
        },
        {
          title: 'Generate an access token',
          body:
            'On the Settings tab, generate an access token for your account (or complete OAuth if your team uses refresh tokens). Copy the token.',
          tip: 'App folder vs Full Dropbox changes what Aiva can see. Match it to what you chose.',
        },
        pasteIntoCarina({
          product: 'Dropbox',
          toolId: 'dropbox',
          fields: 'Paste the access token into the API token / secret field.',
        }),
      ],
      finish: 'Done when probe is green and Aiva can list a file you expect to see.',
    }),

  'companies-house': () =>
    guide({
      id: 'companies-house',
      title: 'Connect Companies House',
      subtitle:
        'Platform path uses COMPANIES_HOUSE_API_KEY from ops. Optional BYOK: paste your Developer Hub API key.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Prefer the platform key (Hire Aiva trials)',
          body:
            'If VERLOX ops already set COMPANIES_HOUSE_API_KEY on Core, open Tool accounts, choose Companies House, '
            + 'Create + probe (no paste needed when the platform key works), then Grant to your Aiva.',
          links: [
            {
              label: 'Open Companies House tool',
              href: '/aiva/tools?tool=companies-house',
            },
            {
              label: 'Companies House Developer Hub',
              href: 'https://developer.company-information.service.gov.uk/',
            },
          ],
          tip: 'Companies House does not return marketing emails. Use it for company and officer identity only.',
        },
        {
          title: 'Optional BYOK: register an API Key app',
          body:
            'Sign in to the Developer Hub, register an application type API Key, copy the key once. '
            + 'Auth is HTTP Basic with the key as username and an empty password (Carina handles that).',
        },
        pasteIntoCarina({
          product: 'Companies House',
          toolId: 'companies-house',
          fields: 'Paste the API key into the API token / secret field only if you are using BYOK.',
          tip: 'Never paste Companies House keys into chat.',
        }),
      ],
      finish:
        'Done when probe is green and Aiva can search for a known company name and return company numbers.',
    }),

  'custom-http': () =>
    guide({
      id: 'custom-http',
      title: 'Connect Custom HTTP',
      subtitle: 'Allowlist a trusted API base URL and optional bearer token.',
      estimatedMinutes: 8,
      steps: [
        {
          title: 'Choose a trusted API only',
          body:
            'Custom HTTP lets Aiva call URLs you allow. Only use APIs you own or fully trust. Example base URL: https://api.example.com',
        },
        {
          title: 'Copy an API token if required',
          body:
            'From that product\'s developer settings, copy a bearer token or API key. If the API is public and needs no auth, you can leave the token blank.',
        },
        {
          title: 'Decide the allowlist',
          body:
            'Write the exact https host (and path prefix if Carina asks). Do not allowlist the whole internet.',
        },
        pasteIntoCarina({
          product: 'Custom HTTP',
          toolId: 'custom-http',
          fields:
            'Paste the token (if any) and fill base URL / allowlist fields exactly, including https.',
        }),
      ],
      finish: 'Done when probe succeeds against the allowlisted host. Keep allowlists tight.',
    }),
};
