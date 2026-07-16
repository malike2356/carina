import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendKnowledgeToPersona,
  resolvePersonaWithKnowledge,
  stripKnowledgeFromPersona,
  workspaceHasKnowledgeAccess,
} from './knowledge-base.js';

const getSubscriptionMock = vi.fn();

vi.mock('./aiva-subscription-store.js', () => ({
  getSubscription: (...args: unknown[]) => getSubscriptionMock(...args),
}));

const poolQueryMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: {
    query: (...args: unknown[]) => poolQueryMock(...args),
  },
}));

describe('stripKnowledgeFromPersona', () => {
  it('removes appended knowledge section', () => {
    const base = 'You are a helpful assistant.';
    const withKb = `${base}\n\n--- Knowledge Base ---\nQ: Hours?\nA: 9-5\n--- End Knowledge Base ---`;
    expect(stripKnowledgeFromPersona(withKb)).toBe(base);
  });

  it('returns prompt unchanged when no knowledge section', () => {
    const base = 'You are a helpful assistant.';
    expect(stripKnowledgeFromPersona(base)).toBe(base);
  });
});

describe('workspaceHasKnowledgeAccess', () => {
  beforeEach(() => {
    getSubscriptionMock.mockReset();
  });

  it('allows business tier', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'business' });
    await expect(workspaceHasKnowledgeAccess('ws-1')).resolves.toBe(true);
  });

  it('denies starter tier', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'starter' });
    await expect(workspaceHasKnowledgeAccess('ws-1')).resolves.toBe(false);
  });
});

describe('resolvePersonaWithKnowledge', () => {
  beforeEach(() => {
    getSubscriptionMock.mockReset();
    poolQueryMock.mockReset();
  });

  it('skips knowledge injection below business', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'team' });
    const base = 'You are a helpful assistant.';
    await expect(resolvePersonaWithKnowledge('worker-1', base, 'ws-1')).resolves.toBe(base);
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  it('appends knowledge on business tier', async () => {
    getSubscriptionMock.mockResolvedValue({ planTier: 'business' });
    poolQueryMock.mockResolvedValue({
      rows: [{ type: 'faq', title: 'Hours', content: 'Q: Hours?\nA: 9-5' }],
    });
    const base = 'You are a helpful assistant.';
    const result = await resolvePersonaWithKnowledge('worker-1', base, 'ws-1');
    expect(result).toContain('--- Knowledge Base ---');
    expect(result).toContain('9-5');
  });
});

describe('appendKnowledgeToPersona', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('returns persona unchanged when no enabled entries', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });
    const base = 'You are a helpful assistant.';
    await expect(appendKnowledgeToPersona(base, 'worker-1')).resolves.toBe(base);
  });
});
