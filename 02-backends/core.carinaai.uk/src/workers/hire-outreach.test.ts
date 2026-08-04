import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Worker } from '../types/index.js';
import { generateHireOutreachContent } from './hire-outreach.js';

vi.mock('../brain/llm.js', () => ({
  llm: {
    chatCheap: vi.fn(),
  },
}));

vi.mock('../tools/web-search-provider.js', () => ({
  runWebSearch: vi.fn().mockResolvedValue([]),
}));

const worker: Worker = {
  id: 'w-1',
  workspaceId: 'ws-1',
  name: 'Ethan',
  roleDescription: 'Strategic advisor for founders.',
  templateId: 'outreach-coordinator',
  personaPrompt: 'test',
  skillPacks: ['communication'],
  channels: ['email', 'whatsapp'],
  language: 'en-GB',
  status: 'active',
  escalationThreshold: 60,
  propreneurTenantSlug: null,
  propreneurBridgeKeyRef: null,
  workerConfig: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('generateHireOutreachContent', () => {
  beforeEach(async () => {
    const { llm } = await import('../brain/llm.js');
    vi.mocked(llm.chatCheap).mockResolvedValue({
      content: JSON.stringify({
        subject: "Hey, I'm Ethan!",
        emailBody: 'Hey Laud,\n\nI am Ethan, your strategic advisor.',
        whatsappBody: "Hey Laud! It's Ethan; check your email when you can.",
      }),
    } as never);
  });

  it('returns LLM-generated outreach when JSON is valid', async () => {
    const result = await generateHireOutreachContent(worker, {
      workspaceId: 'ws-1',
      ownerEmail: 'laud@example.com',
      ownerName: 'Laud Paul',
      ownerPhone: '+447700900000',
      preferredName: 'Laud',
      workFunction: 'Founder',
      personalPreferences: '',
      unsubscribeToken: 'token',
      marketingOptOut: false,
    });

    expect(result.subject).toBe("Hey, I'm Ethan!");
    expect(result.emailBody).toContain('Ethan');
    expect(result.whatsappBody.length).toBeGreaterThan(10);
  });

  it('falls back to a warm template when LLM output is invalid', async () => {
    const { llm } = await import('../brain/llm.js');
    vi.mocked(llm.chatCheap).mockResolvedValue({ content: 'not json' } as never);

    const result = await generateHireOutreachContent(worker, null);
    expect(result.subject).toBe("Hey, I'm Ethan!");
    expect(result.emailBody).toContain('Ethan');
  });
});
