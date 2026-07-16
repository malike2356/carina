import type { AivaPaidTier } from '../billing/aiva-tier.js';
import { tierDisplayLabel } from '../billing/aiva-tier.js';
import { resolveConfigValue } from '../billing/billing-config.js';
import { getQuickConnectChannel } from '../onboarding/channel-quick-connect.js';
import { aivaAppUrl } from './workspace-contact.js';

export type CompleteWelcomeChannel = {
  type: string;
  name: string;
  quickStartInstruction: string;
};

export type CompleteWelcomeEmailData = {
  firstName: string;
  workerName: string;
  workerRole: string;
  templateDomain: string;
  tier: AivaPaidTier;
  tierLabel: string;
  connectedChannel?: CompleteWelcomeChannel;
  pendingChannel?: CompleteWelcomeChannel;
  workspaceUrl: string;
  loginUrl: string;
  channelSetupUrls: Record<string, string>;
  supportEmail: string;
  docsUrl: string;
  /** Public URL for the latest Android APK; omit section when unset. */
  apkUrl?: string;
};

const QUICK_START_BY_DOMAIN: Record<string, [string, string, string]> = {
  property_management: [
    'Send a tenant enquiry and watch your AI reply with availability and pricing',
    'Ask your AI to log a maintenance request and notify the contractor',
    'Request a viewing slot; your AI checks the calendar and confirms',
  ],
  customer_support: [
    'Send a support question; your AI answers using your FAQ knowledge',
    'Forward a tricky ticket; your AI drafts a reply for your approval',
    'Ask your AI to summarise open conversations from today',
  ],
  sales_outreach: [
    'Forward a lead email; your AI qualifies and drafts a follow-up',
    'Ask your AI to summarise your pipeline for the week',
    'Request a personalised follow-up for a prospect who went quiet',
  ],
  finance_admin: [
    'Ask your AI to generate an invoice for a recent project',
    'Send an expense receipt; your AI categorises and logs it',
    'Request a payment reminder for an overdue client',
  ],
  calendar_management: [
    'Ask your AI to schedule a meeting next Tuesday at 2pm',
    'Request a reschedule when a client cancels',
    'Ask for tomorrow\'s agenda with prep notes',
  ],
  general_assistant: [
    'Send a message to your AI and see what it can do',
    'Ask your AI to summarise your inbox priorities',
    'Delegate a routine task and review the draft before it sends',
  ],
};

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web chat',
  webchat: 'Web chat',
  slack: 'Slack',
};

export function quickStartBullets(domain: string): [string, string, string] {
  return QUICK_START_BY_DOMAIN[domain] ?? QUICK_START_BY_DOMAIN.general_assistant;
}

export function channelDisplayLabel(channelId: string): string {
  const normalized = channelId === 'webchat' ? 'web' : channelId;
  return CHANNEL_LABELS[normalized] ?? getQuickConnectChannel(normalized)?.name ?? channelId;
}

export function channelQuickStartInstruction(channelId: string, identifier?: string): string {
  const label = channelDisplayLabel(channelId);
  const normalized = channelId === 'webchat' ? 'web' : channelId;
  const value = identifier?.trim();
  const hasIdentifier = Boolean(value && value !== 'default' && value !== 'web');

  if (normalized === 'telegram' && hasIdentifier) {
    const handle = value!.startsWith('@') ? value! : `@${value}`;
    return `Send a message to ${handle} on Telegram`;
  }
  if (normalized === 'email' && hasIdentifier) {
    return `Email your AI at ${value}`;
  }
  if (normalized === 'whatsapp' && hasIdentifier) {
    return `Message your AI on WhatsApp at ${value}`;
  }
  if (normalized === 'slack' && hasIdentifier) {
    return `DM your AI on Slack (${value})`;
  }
  if (normalized === 'web') {
    return 'Open the web chat widget on your site and send a test message';
  }
  return `Set up ${label} from your worker Channels tab, then send a test message`;
}

export function buildChannelSetupUrls(workerId: string): Record<string, string> {
  const workerChannelsUrl = aivaAppUrl(`/aiva/workers/${workerId}/channels`);
  const urls: Record<string, string> = {
    Telegram: aivaAppUrl('/channels/telegram'),
    'Web chat': aivaAppUrl('/channels/web'),
    Email: aivaAppUrl('/channels/email'),
    WhatsApp: aivaAppUrl('/channels/whatsapp'),
    Slack: aivaAppUrl('/channels/slack'),
  };
  urls['Worker channels'] = workerChannelsUrl;
  return urls;
}

export function resolveSupportEmail(): string {
  return process.env.SUPPORT_EMAIL?.trim() || process.env.SYSTEM_EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.match(/<([^>]+)>/)?.[1] || 'contact@verlox.uk';
}

export function resolveDocsUrl(): string {
  return process.env.AIVA_DOCS_ONBOARDING_URL?.trim() || 'https://carinaai.uk/docs/user/onboarding/';
}

/** Latest Aiva Android APK. Toggle via AIVA_APK_LINK_IN_WELCOME in ops billing config. */
export function resolveAivaApkUrl(): string | undefined {
  const toggle = resolveConfigValue('AIVA_APK_LINK_IN_WELCOME') || 'on';
  if (toggle === 'off') return undefined;
  const configured = process.env.AIVA_APK_URL?.trim();
  if (configured) return configured;
  return aivaAppUrl('/downloads/carina-mobile.apk');
}

export function buildCompleteWelcomeEmailData(input: {
  firstName: string;
  workerName: string;
  workerRole: string;
  templateDomain: string;
  tier: AivaPaidTier;
  workerId: string;
  connectedChannels?: Array<{ channel: string; identifier: string }>;
  selectedChannelId?: string | null;
}): CompleteWelcomeEmailData {
  const tierLabel = tierDisplayLabel(input.tier);
  const selected = input.selectedChannelId?.trim() || null;
  const normalizedSelected = selected === 'webchat' ? 'web' : selected;

  let connectedChannel: CompleteWelcomeChannel | undefined;
  if (normalizedSelected) {
    const row = input.connectedChannels?.find((entry) => entry.channel === normalizedSelected);
    if (row) {
      connectedChannel = {
        type: channelDisplayLabel(row.channel),
        name: row.identifier,
        quickStartInstruction: channelQuickStartInstruction(row.channel, row.identifier),
      };
    }
  }

  let pendingChannel: CompleteWelcomeChannel | undefined;
  if (normalizedSelected && !connectedChannel) {
    pendingChannel = {
      type: channelDisplayLabel(normalizedSelected),
      name: normalizedSelected,
      quickStartInstruction: channelQuickStartInstruction(
        normalizedSelected,
        undefined,
      ),
    };
  }

  return {
    firstName: input.firstName,
    workerName: input.workerName,
    workerRole: input.workerRole,
    templateDomain: input.templateDomain,
    tier: input.tier,
    tierLabel,
    connectedChannel,
    pendingChannel,
    workspaceUrl: aivaAppUrl('/aiva'),
    loginUrl: aivaAppUrl('/login'),
    channelSetupUrls: buildChannelSetupUrls(input.workerId),
    supportEmail: resolveSupportEmail(),
    docsUrl: resolveDocsUrl(),
    apkUrl: resolveAivaApkUrl(),
  };
}

export function completeWelcomeSubject(workerName: string): string {
  return `Hey, I'm ${workerName}!`;
}
