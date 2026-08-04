import type { AgentMarketplaceTemplate } from '../marketplace/template-registry.js';
import { updateWorker, getWorker } from '../workers/worker-store.js';
import type { WorkerConfig } from '../types/index.js';

export type WorkspaceSetupTip = {
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
};

export function buildSetupTip(
  workspaceId: string,
  template: Pick<AgentMarketplaceTemplate, 'name' | 'domain'>,
): WorkspaceSetupTip {
  return {
    title: 'Your AI is ready',
    body: `Your ${template.name} is configured and live. You can add more tools, connect more channels, and customise your AI anytime from Settings.`,
    actionUrl: `/workspace/${workspaceId}/settings`,
    actionLabel: 'Explore capabilities',
  };
}

export type ApplyMarketplaceTemplateResult = {
  tip: WorkspaceSetupTip;
  templateDomain: string;
};

/**
 * Applies marketplace template metadata after worker provisioning.
 * Template sets starting persona, tools, and skills; the workspace keeps full Carina capabilities.
 */
export async function applyMarketplaceTemplateConfig(options: {
  workspaceId: string;
  workerId: string;
  template: AgentMarketplaceTemplate;
}): Promise<ApplyMarketplaceTemplateResult> {
  const tip = buildSetupTip(options.workspaceId, options.template);
  const worker = await getWorker(options.workspaceId, options.workerId);
  const existingConfig: WorkerConfig = worker?.workerConfig ?? {};

  await updateWorker(options.workspaceId, options.workerId, {
    workerConfig: {
      ...existingConfig,
      onboarding: {
        setupTip: tip,
        templateDomain: options.template.domain,
        templateTools: options.template.tools,
        templateSkills: options.template.skills,
      },
    },
  });

  return {
    tip,
    templateDomain: options.template.domain,
  };
}
