import { listWorkerChannelDetails, readChannelCredentials } from '../channels/channel-store.js';
import {
  isSocialChannel,
  socialCredentialsComplete,
  type SocialChannelName,
} from '../channels/social-channel-utils.js';
import type { AivaChannelName } from '../channels/types.js';
import { getSocialSettings } from '../ingestion/social/social-settings-store.js';
import { listAutomations } from './worker-store.js';
import type { WorkerRoleTemplate } from './role-templates.js';

export const SOCIAL_PRESENCE_SKILL_PACK = 'social-extended';

export interface WorkerRuntimeCapabilityContext {
  connectedChannels: SocialChannelName[];
  disconnectedSocialChannels: SocialChannelName[];
  socialApprovalRequired: boolean;
  socialAutoReplyEnabled: boolean;
  hasEnabledAutomations: boolean;
  isWebPreviewSession: boolean;
  activeChannel: AivaChannelName;
}

export const SOCIAL_CAPABILITY_PERSONA_BLOCK = [
  'Native social channels (when connected on this worker):',
  '- Inbound DMs arrive via platform webhooks; you draft replies for the human approval inbox unless auto-reply is enabled for simple thanks.',
  '- Public post drafts also wait for approval before publish.',
  '- Scheduled automations (digest, engagement scan) can run without the user opening chat.',
  '',
  'Before claiming you cannot monitor DMs or act in the background:',
  '- Read the LIVE WORKER CONTEXT block appended on each turn.',
  '- If connectedChannels includes the platform the user asked about, do NOT say you cannot monitor that channel.',
  '- Say instead that new DMs are processed when they arrive, drafts wait in the approval inbox, and automations can run on a schedule.',
  '- If the platform is in disconnectedSocialChannels, tell them to open this worker\'s Channels tab and use Connect for that platform.',
  '- If sessionMode is web_chat_preview, clarify that this chat is session-only; live DMs use connected channels outside this preview.',
].join('\n');

export function templateHasSocialPresenceCapability(template: WorkerRoleTemplate): boolean {
  return template.skillPacks.includes(SOCIAL_PRESENCE_SKILL_PACK)
    || template.defaultChannels.some((channel) => isSocialChannel(channel));
}

export function workerHasSocialPresenceCapability(input: {
  skillPacks: string[];
  channels: string[];
}): boolean {
  return input.skillPacks.includes(SOCIAL_PRESENCE_SKILL_PACK)
    || input.channels.some((channel) => isSocialChannel(channel));
}

function socialChannelDisplayName(channel: SocialChannelName): string {
  switch (channel) {
    case 'linkedin':
      return 'LinkedIn';
    case 'instagram':
      return 'Instagram';
    case 'messenger':
      return 'Facebook Messenger';
    case 'twitter':
      return 'X (Twitter)';
    case 'tiktok':
      return 'TikTok';
    default:
      return channel;
  }
}

export function socialChannelDisplayNameFor(channel: string): string {
  return isSocialChannel(channel) ? socialChannelDisplayName(channel) : channel;
}

export async function resolveWorkerRuntimeCapabilityContext(input: {
  workerId: string;
  workspaceId: string;
  channel: AivaChannelName;
  isWebPreviewSession?: boolean;
}): Promise<WorkerRuntimeCapabilityContext> {
  const [rows, settings, automations] = await Promise.all([
    listWorkerChannelDetails(input.workerId),
    getSocialSettings(input.workspaceId),
    listAutomations(input.workerId),
  ]);

  const connectedChannels: SocialChannelName[] = [];
  for (const row of rows) {
    if (!isSocialChannel(row.channel) || !row.enabled || !row.verified) continue;
    if (row.identifier === 'pending') continue;
    const credentials = readChannelCredentials(row);
    if (!socialCredentialsComplete(row.channel, credentials)) continue;
    connectedChannels.push(row.channel);
  }

  const allSocial: SocialChannelName[] = ['linkedin', 'instagram', 'messenger', 'twitter', 'tiktok'];
  const disconnectedSocialChannels = allSocial.filter((channel) => !connectedChannels.includes(channel));

  return {
    connectedChannels,
    disconnectedSocialChannels,
    socialApprovalRequired: settings.socialRequireApproval,
    socialAutoReplyEnabled: settings.socialAutoReplyEnabled,
    hasEnabledAutomations: automations.some((item) => item.enabled),
    isWebPreviewSession: input.isWebPreviewSession ?? input.channel === 'web',
    activeChannel: input.channel,
  };
}

export function buildWorkerCapabilityContextSuffix(
  context: WorkerRuntimeCapabilityContext,
): string {
  const sessionMode = context.isWebPreviewSession ? 'web_chat_preview' : 'worker_channel';
  const connected = context.connectedChannels.length > 0
    ? context.connectedChannels.join(', ')
    : 'none';
  const disconnected = context.disconnectedSocialChannels.length > 0
    ? context.disconnectedSocialChannels.join(', ')
    : 'none';

  const lines = [
    '--- LIVE WORKER CONTEXT ---',
    `sessionMode: ${sessionMode}`,
    `activeChannel: ${context.activeChannel}`,
    `connectedChannels: ${connected}`,
    `disconnectedSocialChannels: ${disconnected}`,
    `socialApprovalRequired: ${context.socialApprovalRequired}`,
    `socialAutoReplyEnabled: ${context.socialAutoReplyEnabled}`,
    `hasEnabledAutomations: ${context.hasEnabledAutomations}`,
    '',
    'Response rules for this turn:',
  ];

  if (sessionMode === 'web_chat_preview') {
    lines.push(
      '- This conversation is a web chat preview. You only respond when the user messages you here.',
      '- Live social DMs are handled on connected native channels outside this chat.',
      '- If connectedChannels is not "none", say inbound DMs on those platforms are processed when they arrive and drafts go to the approval inbox.',
      '- Point the user to the worker Channels tab to connect platforms listed under disconnectedSocialChannels.',
      '- Do not give a blanket refusal that you cannot monitor social accounts when connectedChannels includes the platform they asked about.',
    );
  } else if (context.connectedChannels.includes(context.activeChannel as SocialChannelName)) {
    lines.push(
      `- You are replying on ${socialChannelDisplayNameFor(context.activeChannel)}, which is connected.`,
      '- Inbound messages on this channel are processed when they arrive; outbound drafts require approval when socialApprovalRequired is true.',
    );
  } else if (context.connectedChannels.length > 0) {
    lines.push(
      '- This message is not on a native social channel, but other social channels are connected for this worker.',
      '- Refer to connectedChannels when explaining live DM handling and the approval inbox.',
    );
  } else {
    lines.push(
      '- No native social channels are connected yet.',
      '- Tell the user which Connect buttons to use on the worker Channels tab for the platforms they asked about.',
    );
  }

  if (context.socialApprovalRequired) {
    lines.push('- Never claim you can publish posts or send DMs without human approval.');
  }

  lines.push('--- END LIVE WORKER CONTEXT ---');
  return `\n\n${lines.join('\n')}`;
}
