import { createAivaCheckoutSession } from '../billing/aiva-stripe-checkout.js';
import { isAivaCheckoutTier, tierDisplayLabel, UNLIMITED_SLOT_DB_VALUE, type AivaPaidTier } from '../billing/aiva-tier.js';
import { defaultPlaybookIdForRoleTemplate } from '../workers/aiva-playbook-templates.js';
import { buildPersonaPrompt } from '../workers/persona-builder.js';
import { provisionWorkerPlaybook } from '../workers/provision-worker-playbook.js';
import { getRoleTemplate } from '../workers/role-templates.js';
import { getSubscriptionStatus, provisionTrial } from '../workers/aiva-subscription-store.js';
import { createWorker, getWorker } from '../workers/worker-store.js';
import { provisionWorkerChannels } from '../workers/provision-worker-channels.js';
import { meetsRecommendedTier } from '../provisioning/tier-recommender.js';
import { getMarketplaceTemplate } from './template-registry.js';
import { applyMarketplaceTemplateConfig } from '../workspace/workspace-template-applier.js';
import { tryAutoBindPropreneurOnHire } from '../bridges/propreneur-auto-bridge.js';

export type ProvisionFromTemplateResult =
  | {
      status: 'live';
      workerId: string;
      workspaceId: string;
      templateId: string;
      tier: AivaPaidTier;
      provisionedAt: string;
      setupTip?: {
        title: string;
        body: string;
        actionUrl: string;
        actionLabel: string;
      };
      templateDomain?: string;
    }
  | {
      status: 'checkout_required';
      recommendedTier: AivaPaidTier;
      tierLabel: string;
      checkoutUrl: string;
      reason: string;
    };

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

export async function provisionFromMarketplaceTemplate(options: {
  workspaceId: string;
  templateId: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<ProvisionFromTemplateResult> {
  const template = getMarketplaceTemplate(options.templateId);
  if (!template) {
    throw new Error(`Unknown template: ${options.templateId}`);
  }

  const roleTemplate = getRoleTemplate(template.roleTemplateId);
  if (!roleTemplate) {
    throw new Error(`Role template not found: ${template.roleTemplateId}`);
  }

  const status = await getSubscriptionStatus(options.workspaceId);
  const currentTier = String(status.planTier ?? 'trial');

  if (
    currentTier !== 'trial'
    && !meetsRecommendedTier(currentTier, template.tier)
    && isAivaCheckoutTier(template.tier)
  ) {
    const checkout = await createAivaCheckoutSession({
      workspaceId: options.workspaceId,
      tier: template.tier,
      interval: 'month',
      successUrl: options.successUrl ?? `${process.env.AIVA_APP_URL ?? 'https://admin.hireaiva.co.uk'}/aiva/marketplace?provisioned=${encodeURIComponent(template.templateId)}`,
      cancelUrl: options.cancelUrl ?? `${process.env.AIVA_APP_URL ?? 'https://admin.hireaiva.co.uk'}/aiva/marketplace`,
    });
    return {
      status: 'checkout_required',
      recommendedTier: template.tier,
      tierLabel: tierDisplayLabel(template.tier),
      checkoutUrl: checkout.url,
      reason: `This template requires the ${tierDisplayLabel(template.tier)} plan.`,
    };
  }

  await assertSlotAvailable(options.workspaceId);

  const personaPrompt = buildPersonaPrompt(template.name, roleTemplate, template.description);
  const worker = await createWorker(options.workspaceId, {
    name: template.name,
    roleDescription: template.description,
    templateId: template.roleTemplateId,
    personaPrompt,
    skillPacks: roleTemplate.skillPacks,
    channels: roleTemplate.defaultChannels,
    language: 'en-GB',
  });

  const playbookId = defaultPlaybookIdForRoleTemplate(template.roleTemplateId);
  if (playbookId) {
    await provisionWorkerPlaybook(options.workspaceId, worker.id, { playbookId });
  }

  await provisionWorkerChannels(worker, options.workspaceId, roleTemplate.defaultChannels, []);

  const refreshed = await getWorker(options.workspaceId, worker.id);
  const liveWorker = refreshed ?? worker;
  const applied = await applyMarketplaceTemplateConfig({
    workspaceId: options.workspaceId,
    workerId: liveWorker.id,
    template,
  });

  void tryAutoBindPropreneurOnHire({
    workspaceId: options.workspaceId,
    worker: liveWorker,
    templateId: template.roleTemplateId,
    skillPacks: roleTemplate.skillPacks,
  }).catch((err) => {
    console.warn('[marketplace] propreneur auto-bind failed:', err);
  });

  return {
    status: 'live',
    workerId: liveWorker.id,
    workspaceId: options.workspaceId,
    templateId: template.templateId,
    tier: template.tier,
    provisionedAt: new Date().toISOString(),
    setupTip: applied.tip,
    templateDomain: applied.templateDomain,
  };
}
