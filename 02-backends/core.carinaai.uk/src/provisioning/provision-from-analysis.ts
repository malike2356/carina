import { createAivaCheckoutSession } from '../billing/aiva-stripe-checkout.js';
import {
  isAivaCheckoutTier,
  tierDisplayLabel,
  UNLIMITED_SLOT_DB_VALUE,
  type AivaPaidTier,
} from '../billing/aiva-tier.js';
import { defaultPlaybookIdForRoleTemplate } from '../workers/aiva-playbook-templates.js';
import { buildCustomPersonaPrompt, buildPersonaPrompt } from '../workers/persona-builder.js';
import { getRoleTemplate } from '../workers/role-templates.js';
import { getSubscriptionStatus, provisionTrial } from '../workers/aiva-subscription-store.js';
import { createWorker, getWorker } from '../workers/worker-store.js';
import { provisionWorkerChannels } from '../workers/provision-worker-channels.js';
import { provisionWorkerPlaybook } from '../workers/provision-worker-playbook.js';
import { meetsRecommendedTier } from './tier-recommender.js';
import { tryAutoBindPropreneurOnHire } from '../bridges/propreneur-auto-bridge.js';
import type { AnalysedRole } from './role-analyser.js';

export type ProvisionFromAnalysisResult =
  | {
      status: 'live';
      workerId: string;
      workspaceId: string;
      tier: AivaPaidTier;
      tierLabel: string;
      provisionedAt: string;
      scoutProtection: boolean;
    }
  | {
      status: 'checkout_required';
      recommendedTier: AivaPaidTier;
      tierLabel: string;
      checkoutUrl: string;
      reason: string;
    };

function workerChannelsFromAnalysis(analysis: AnalysedRole): string[] {
  const mapped = analysis.communicationChannels
    .map((channel) => {
      if (channel === 'web_chat') return 'web';
      return channel;
    })
    .filter((channel) => channel !== 'web_chat');

  if (mapped.length > 0) return [...new Set(mapped)];

  const template = analysis.roleTemplateId ? getRoleTemplate(analysis.roleTemplateId) : null;
  return template?.defaultChannels ?? ['email'];
}

async function assertSlotAvailable(workspaceId: string): Promise<void> {
  let status = await getSubscriptionStatus(workspaceId);
  if (Number(status.slotLimit) === 0 && Number(status.aivasUsed) === 0) {
    await provisionTrial(workspaceId);
    status = await getSubscriptionStatus(workspaceId);
  }
  const slotLimit = Number(status.slotLimit ?? 0);
  const used = Number(status.aivasUsed ?? 0);
  if (slotLimit >= UNLIMITED_SLOT_DB_VALUE) return;
  if (status.status === 'suspended') {
    throw new Error('Trial expired. Upgrade your plan to hire more Aivas.');
  }
  if (slotLimit > 0 && used >= slotLimit) {
    const err = new Error('Aiva slot limit reached for your plan.');
    (err as Error & { slotMeta?: Record<string, unknown> }).slotMeta = {
      code: 'aiva_slot_limit_reached',
      currentTier: status.planTier,
      slotLimit,
      aivasUsed: used,
    };
    throw err;
  }
}

export async function provisionFromRoleAnalysis(options: {
  workspaceId: string;
  analysis: AnalysedRole;
  roleName?: string;
  roleDescription?: string;
  channels?: string[];
  successUrl?: string;
  cancelUrl?: string;
}): Promise<ProvisionFromAnalysisResult> {
  const analysis = options.analysis;
  const roleName = String(options.roleName ?? analysis.suggestedName).trim();
  const roleDescription = String(options.roleDescription ?? analysis.roleDescription).trim();
  const recommendedTier = analysis.recommendedTier;
  const status = await getSubscriptionStatus(options.workspaceId);
  const currentTier = String(status.planTier ?? 'trial');

  if (
    currentTier !== 'trial'
    && !meetsRecommendedTier(currentTier, recommendedTier)
    && isAivaCheckoutTier(recommendedTier)
  ) {
    const checkout = await createAivaCheckoutSession({
      workspaceId: options.workspaceId,
      tier: recommendedTier,
      interval: 'month',
      successUrl:
        options.successUrl
        ?? `${process.env.AIVA_APP_URL ?? 'https://admin.hireaiva.co.uk'}/aiva/provision?step=3`,
      cancelUrl:
        options.cancelUrl
        ?? `${process.env.AIVA_APP_URL ?? 'https://admin.hireaiva.co.uk'}/aiva/provision?step=2`,
    });
    return {
      status: 'checkout_required',
      recommendedTier,
      tierLabel: tierDisplayLabel(recommendedTier),
      checkoutUrl: checkout.url,
      reason: `This worker needs the ${tierDisplayLabel(recommendedTier)} plan.`,
    };
  }

  await assertSlotAvailable(options.workspaceId);

  const templateId = analysis.roleTemplateId;
  const template = templateId ? getRoleTemplate(templateId) : null;
  const channels = options.channels?.length
    ? options.channels
    : workerChannelsFromAnalysis(analysis);

  const personaPrompt = template
    ? buildPersonaPrompt(roleName, template, roleDescription)
    : buildCustomPersonaPrompt(roleName, roleDescription);
  const skillPacks = template?.skillPacks ?? ['communication'];

  const worker = await createWorker(options.workspaceId, {
    name: roleName,
    roleDescription,
    templateId,
    personaPrompt,
    skillPacks,
    channels,
    language: 'en-GB',
  });

  const playbookId = defaultPlaybookIdForRoleTemplate(templateId);
  if (playbookId) {
    await provisionWorkerPlaybook(options.workspaceId, worker.id, { playbookId });
  }

  await provisionWorkerChannels(worker, options.workspaceId, channels, []);

  const refreshed = await getWorker(options.workspaceId, worker.id);
  const liveWorker = refreshed ?? worker;

  void tryAutoBindPropreneurOnHire({
    workspaceId: options.workspaceId,
    worker: liveWorker,
    templateId,
    skillPacks,
  }).catch((err) => {
    console.warn('[provision-from-analysis] propreneur auto-bind failed:', err);
  });

  return {
    status: 'live',
    workerId: liveWorker.id,
    workspaceId: options.workspaceId,
    tier: recommendedTier,
    tierLabel: tierDisplayLabel(recommendedTier),
    provisionedAt: new Date().toISOString(),
    scoutProtection: true,
  };
}
