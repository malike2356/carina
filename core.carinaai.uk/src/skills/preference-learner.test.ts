import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockPreference(chatContent: string) {
  vi.doMock('../brain/llm.js', () => ({
    llm: { chatCheap: vi.fn().mockResolvedValue({ content: chatContent }) },
  }));
  vi.doMock('../memory/persistent-memory.js', () => ({
    getPersistentFactsText: vi.fn().mockResolvedValue('Operator prefers concise replies'),
    addPersistentFact: vi.fn().mockResolvedValue({ id: 'f1', content: 'x', createdAt: new Date() }),
    replacePersistentFact: vi.fn().mockResolvedValue({ id: 'f1', content: 'x', createdAt: new Date() }),
  }));
  vi.doMock('./learning-events.js', () => ({
    appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
  }));
}

describe('preference-learner', () => {
  it('adds a new preference on first correction', async () => {
    mockPreference('Operator prefers POST over GET for mutations');
    vi.doMock('../memory/persistent-memory.js', () => ({
      getPersistentFactsText: vi.fn().mockResolvedValue(''),
      addPersistentFact: vi.fn().mockResolvedValue({ id: 'f1', content: 'x', createdAt: new Date() }),
      replacePersistentFact: vi.fn().mockResolvedValue({ id: 'f1', content: 'x', createdAt: new Date() }),
    }));
    vi.doMock('./learning-events.js', () => ({
      appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
    }));
    const { learnPreferenceFromCorrection } = await import('./preference-learner.js');
    const result = await learnPreferenceFromCorrection('No, use POST instead of GET');
    expect(result.learned).toBe(true);
    expect(result.action).toBe('added');
  });

  it('skips vague corrections', async () => {
    mockPreference('none');
    const { learnPreferenceFromCorrection } = await import('./preference-learner.js');
    const result = await learnPreferenceFromCorrection('wrong');
    expect(result.learned).toBe(false);
    expect(result.action).toBe('skipped');
  });

  it('skips vague corrections with low confidence', async () => {
    mockPreference('wrong answer');
    const { learnPreferenceFromCorrection } = await import('./preference-learner.js');
    const result = await learnPreferenceFromCorrection('wrong');
    expect(result.learned).toBe(false);
    expect(result.action).toBe('skipped');
  });

  it('replaces overlapping preference on repeated correction', async () => {
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap: vi.fn().mockResolvedValue({
          content: 'Operator prefers POST for all API calls',
        }),
      },
    }));
    vi.doMock('../memory/persistent-memory.js', () => ({
      getPersistentFactsText: vi.fn().mockResolvedValue('Operator prefers GET for all API calls'),
      addPersistentFact: vi.fn(),
      replacePersistentFact: vi.fn().mockResolvedValue({ id: 'f1', content: 'x', createdAt: new Date() }),
    }));
    vi.doMock('./learning-events.js', () => ({
      appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
    }));
    const { learnPreferenceFromCorrection } = await import('./preference-learner.js');
    const result = await learnPreferenceFromCorrection('Actually always use POST, not GET');
    expect(result.learned).toBe(true);
    expect(result.action).toBe('replaced');
  });
});
