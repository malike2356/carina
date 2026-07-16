import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSetupTip, applyMarketplaceTemplateConfig } from './workspace-template-applier.js';
import type { AgentMarketplaceTemplate } from '../marketplace/template-registry.js';

const getWorkerMock = vi.fn();
const updateWorkerMock = vi.fn();

vi.mock('../workers/worker-store.js', () => ({
  getWorker: (...args: unknown[]) => getWorkerMock(...args),
  updateWorker: (...args: unknown[]) => updateWorkerMock(...args),
}));

const template: AgentMarketplaceTemplate = {
  templateId: 'support-agent',
  roleTemplateId: 'customer-support',
  name: 'Support Agent',
  domain: 'customer_support',
  icon: 'headphones',
  tagline: 'Support',
  description: 'Handles support emails',
  features: [],
  tools: ['email-read', 'email-send'],
  skills: ['faq-responses'],
  tier: 'starter',
  setupTimeSeconds: 45,
  useCaseExample: 'Example',
  requiredIntegrations: [],
  scoutPolicy: {
    sandbox: { mode: 'session_only' },
    egress: { mode: 'allowlist', scanOutbound: false },
    tools: { dangerousRequireConfirmation: ['email-send'] },
    governance: { autoResponseTier: 'high' },
  },
  greeting: 'Hello',
};

describe('buildSetupTip', () => {
  it('returns actionable setup guidance', () => {
    const tip = buildSetupTip('ws-1', template);
    expect(tip.title).toBe('Your AI is ready');
    expect(tip.body).toContain('Support Agent');
    expect(tip.actionUrl).toBe('/workspace/ws-1/settings');
  });
});

describe('applyMarketplaceTemplateConfig', () => {
  beforeEach(() => {
    getWorkerMock.mockReset();
    updateWorkerMock.mockReset();
  });

  it('stores onboarding metadata on the worker', async () => {
    getWorkerMock.mockResolvedValue({
      id: 'worker-1',
      workerConfig: { playbook: { playbookId: 'x' } },
    });
    updateWorkerMock.mockResolvedValue({});

    const result = await applyMarketplaceTemplateConfig({
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      template,
    });

    expect(result.templateDomain).toBe('customer_support');
    expect(updateWorkerMock).toHaveBeenCalledWith('ws-1', 'worker-1', {
      workerConfig: expect.objectContaining({
        playbook: { playbookId: 'x' },
        onboarding: expect.objectContaining({
          templateDomain: 'customer_support',
          templateTools: ['email-read', 'email-send'],
        }),
      }),
    });
  });
});
