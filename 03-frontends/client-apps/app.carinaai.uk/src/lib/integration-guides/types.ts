export type IntegrationGuideId =
  | 'google-drive'
  | 'google-gmail'
  | 'google-calendar'
  | 'google-tools'
  | 'telegram'
  | 'whatsapp'
  | 'slack'
  | 'discord'
  | 'sms'
  | 'voice'
  | 'teams'
  | 'caldav'
  | 'imap'
  | 'linkedin'
  | 'meta-social'
  | 'twitter'
  | 'tiktok'
  | 'hubspot'
  | 'pipedrive'
  | 'salesforce'
  | 'stripe'
  | 'zendesk'
  | 'freshdesk'
  | 'intercom'
  | 'slack-tool'
  | 'notion'
  | 'airtable'
  | 'trello'
  | 'asana'
  | 'linear'
  | 'jira'
  | 'github'
  | 'calendly'
  | 'mailchimp'
  | 'beehiiv'
  | 'shopify'
  | 'supabase'
  | 'clickup'
  | 'monday'
  | 'todoist'
  | 'dropbox'
  | 'companies-house'
  | 'custom-http';

export type GuideCopyItem = {
  label: string;
  value: string;
  hint?: string;
};

export type GuideExternalLink = {
  label: string;
  href: string;
};

export type GuideStep = {
  title: string;
  body: string;
  links?: GuideExternalLink[];
  copyItems?: GuideCopyItem[];
  tip?: string;
};

export type IntegrationGuide = {
  id: IntegrationGuideId;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  steps: GuideStep[];
  finish: string;
};
