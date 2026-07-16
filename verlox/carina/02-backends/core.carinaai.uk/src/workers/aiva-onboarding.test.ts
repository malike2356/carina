import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Worker } from '../types/index.js';
import { sendWorkerOnboardingMessage, summarizeRoleDescription } from './aiva-onboarding.js';

const sendMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../channels/adapter-registry.js', () => ({
  getAdapter: () => ({
    channel: 'email',
    verify: () => true,
    parse: () => null,
    send: sendMock,
  }),
}));

vi.mock('../brain/llm.js', () => ({
  llm: {
    chatCheap: vi.fn().mockResolvedValue({ content: 'tenant support and maintenance requests.' }),
  },
}));

const worker: Worker = {
  id: 'w-1',
  workspaceId: 'ws-1',
  name: 'Aria',
  roleDescription: 'Handle tenant support and maintenance requests.',
  templateId: 'customer-support',
  personaPrompt: 'test',
  skillPacks: ['communication'],
  channels: ['email'],
  language: 'en-GB',
  status: 'active',
  escalationThreshold: 60,
  propreneurTenantSlug: null,
  propreneurBridgeKeyRef: null,
  workerConfig: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('aiva-onboarding', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('summarises role description via llm with fallback', async () => {
    await expect(summarizeRoleDescription(worker.roleDescription)).resolves.toBe(
      'tenant support and maintenance requests.',
    );
  });

  it('sends the first-message template through the channel adapter', async () => {
    await sendWorkerOnboardingMessage(worker, 'email', 'owner@example.com', {
      from_address: 'aria@mail.carinaai.uk',
      worker_name: 'Aria',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        contactId: 'owner@example.com',
        content: expect.stringContaining("Hey, I'm Aria."),
      }),
      expect.objectContaining({ from_address: 'aria@mail.carinaai.uk' }),
    );
  });

  it('mentions social channel setup for social-media workers', async () => {
    const socialWorker: Worker = {
      ...worker,
      templateId: 'social-media-manager',
      skillPacks: ['social-extended', 'marketing-ops'],
      channels: ['web', 'linkedin', 'instagram'],
    };
    await sendWorkerOnboardingMessage(socialWorker, 'web', 'preview-contact');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringMatching(/Channels tab/i),
      }),
      expect.any(Object),
    );
  });
});
