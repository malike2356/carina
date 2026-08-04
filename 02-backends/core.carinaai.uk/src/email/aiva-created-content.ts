import { normalizeAivaTier, tierDisplayLabel, type AivaPaidTier } from '../billing/aiva-tier.js';
import { getMarketplaceTemplate } from '../marketplace/template-registry.js';
import { getRoleTemplate } from '../workers/role-templates.js';
import { getSubscriptionStatus } from '../workers/aiva-subscription-store.js';
import { getWorker, listWorkerChannels } from '../workers/worker-store.js';
import {
  channelDisplayLabel,
  quickStartBullets,
  resolveAivaApkUrl,
  resolveDocsUrl,
  resolveSupportEmail,
} from './complete-welcome-content.js';
import { aivaAppUrl } from './workspace-contact.js';

export type AivaCreatedEmailData = {
  firstName: string;
  workerName: string;
  role: string;
  templateLabel: string | null;
  language: string;
  skillLabels: string[];
  capabilityHints: string[];
  tryNextHints: [string, string, string];
  tierLabel: string;
  hostedEmailAddress: string | null;
  connectedChannelLabels: string[];
  portalUrl: string;
  channelsUrl: string;
  trainingUrl: string;
  settingsUrl: string;
  overviewUrl: string;
  workspaceUrl: string;
  supportEmail: string;
  docsUrl: string;
  apkUrl?: string;
};

function humanizeSkill(skill: string): string {
  return skill
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function languageLabel(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === 'en-gb' || normalized === 'en') return 'English (UK)';
  if (normalized === 'en-us') return 'English (US)';
  return code.trim() || 'English (UK)';
}

export async function buildAivaCreatedEmailData(input: {
  firstName: string;
  workspaceId: string;
  workerId: string;
  workerName: string;
  role: string;
  hostedEmailAddress?: string | null;
}): Promise<AivaCreatedEmailData> {
  const worker = await getWorker(input.workspaceId, input.workerId);
  const templateId = worker?.templateId ?? null;
  const marketplace = templateId ? getMarketplaceTemplate(templateId) : null;
  const roleTemplate = templateId
    ? getRoleTemplate(templateId) ?? (marketplace ? getRoleTemplate(marketplace.roleTemplateId) : undefined)
    : undefined;

  const skillSource = worker?.skillPacks?.length
    ? worker.skillPacks
    : roleTemplate?.skillPacks ?? marketplace?.skills ?? [];
  const skillLabels = skillSource.map(humanizeSkill).filter(Boolean).slice(0, 8);

  const capabilityHints = (
    roleTemplate?.personaBlocks.capabilities
    ?? marketplace?.features
    ?? []
  )
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 4);

  const templateDomain = marketplace?.domain ?? 'general_assistant';
  const tryNextHints = quickStartBullets(templateDomain);

  const subscription = await getSubscriptionStatus(input.workspaceId);
  const tier = normalizeAivaTier(String(subscription.planTier ?? 'trial')) as AivaPaidTier;

  let connectedChannelLabels: string[] = [];
  try {
    const channels = await listWorkerChannels(input.workerId);
    connectedChannelLabels = channels
      .map((row) => channelDisplayLabel(String(row.channel ?? '')))
      .filter(Boolean)
      .filter((label, index, all) => all.indexOf(label) === index);
  } catch {
    connectedChannelLabels = [];
  }

  const portalUrl = aivaAppUrl(`/aiva/workers/${input.workerId}`);

  return {
    firstName: input.firstName,
    workerName: worker?.name?.trim() || input.workerName,
    role: (worker?.roleDescription?.trim() || input.role || 'AI employee').trim(),
    templateLabel: marketplace?.name ?? roleTemplate?.name ?? null,
    language: languageLabel(worker?.language ?? 'en-GB'),
    skillLabels,
    capabilityHints,
    tryNextHints,
    tierLabel: tierDisplayLabel(tier),
    hostedEmailAddress: input.hostedEmailAddress?.trim() || null,
    connectedChannelLabels,
    portalUrl,
    channelsUrl: `${portalUrl}?tab=channels`,
    trainingUrl: `${portalUrl}?tab=training`,
    settingsUrl: `${portalUrl}?tab=settings`,
    overviewUrl: `${portalUrl}?tab=overview`,
    workspaceUrl: aivaAppUrl('/aiva'),
    supportEmail: resolveSupportEmail(),
    docsUrl: resolveDocsUrl(),
    apkUrl: resolveAivaApkUrl(),
  };
}

export function aivaCreatedSubject(workerName: string): string {
  return `Meet ${workerName}, your new Aiva`;
}
