import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockLearningLoop(result: unknown, isCorrection = false) {
  vi.doMock('./learning-loop.js', () => ({
    runLearningLoop: vi.fn().mockResolvedValue(result),
    isUserCorrection: vi.fn().mockImplementation((msg: string) => {
      if (isCorrection) return true;
      return msg.toLowerCase().trimStart().startsWith('no,');
    }),
  }));
  vi.doMock('./curator.js', () => ({
    runLightCuratorPass: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('./task-outcome.js', () => ({
    persistTaskOutcome: vi.fn().mockResolvedValue({ saved: false, reason: 'mock' }),
  }));
}

describe('evaluateAfterTurn', () => {
  it('returns null when toolsUsed has fewer than 3 entries', async () => {
    mockLearningLoop({ saved: true, skillName: 'some-skill', action: 'created' });
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a thing',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2'],
      toolCallLog: [],
    });
    expect(result).toBeNull();
  });

  it('returns null when evaluator throws', async () => {
    vi.doMock('./learning-loop.js', () => ({
      runLearningLoop: vi.fn().mockRejectedValue(new Error('LLM down')),
      isUserCorrection: vi.fn().mockReturnValue(false),
    }));
    vi.doMock('./curator.js', () => ({
      runLightCuratorPass: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('./task-outcome.js', () => ({
      persistTaskOutcome: vi.fn().mockResolvedValue({ saved: false }),
    }));
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a thing',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: [],
    });
    expect(result).toBeNull();
  });

  it('returns learning notice when learning loop creates a skill', async () => {
    mockLearningLoop({ saved: true, skillName: 'my-new-skill', action: 'created' });
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a multi-step thing',
      assistantText: 'completed successfully',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: ['tool1: {}', 'tool2: {}', 'tool3: {}'],
    });
    expect(result).toEqual({ kind: 'skill', skillName: 'my-new-skill', action: 'created' });
  });

  it('returns learning notice when a correction refines an existing skill', async () => {
    mockLearningLoop({ saved: true, skillName: 'existing-skill', action: 'refined' }, true);
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'No, do it the other way',
      assistantText: 'done',
      toolsUsed: ['tool1'],
      toolCallLog: [],
    });
    expect(result).toEqual({ kind: 'skill', skillName: 'existing-skill', action: 'refined' });
  });

  it('returns preference notice on first correction', async () => {
    mockLearningLoop({
      saved: false,
      action: 'preference_only',
      preferenceLearned: true,
      preferenceText: 'Operator prefers POST over GET for mutations',
      preferenceAction: 'added',
    }, true);
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'No, always use POST instead of GET',
      assistantText: 'done',
      toolsUsed: ['http-request'],
      toolCallLog: [],
    });
    expect(result).toEqual({
      kind: 'preference',
      preference: 'Operator prefers POST over GET for mutations',
      action: 'added',
    });
  });

  it('returns protected notice when weak evidence would overwrite a good skill', async () => {
    mockLearningLoop({
      saved: false,
      action: 'incremented',
      skillName: 'fetch-and-parse',
      blockedReason: 'weak_evidence',
    });
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'fetch and parse a URL',
      assistantText: 'failed',
      toolsUsed: ['a', 'b', 'c'],
      toolCallLog: [],
    });
    expect(result).toEqual({
      kind: 'protected',
      skillName: 'fetch-and-parse',
      reason: 'weak_evidence',
    });
  });

  it('returns ignored notice for vague corrections', async () => {
    mockLearningLoop({
      saved: false,
      preferenceLearned: false,
      preferenceAction: 'skipped',
      preferenceSkipReason: 'low_confidence',
    }, true);
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'wrong',
      assistantText: 'done',
      toolsUsed: ['tool1'],
      toolCallLog: [],
    });
    expect(result).toEqual({ kind: 'ignored', reason: 'low_confidence' });
  });

  it('returns outcome notice when no skill is saved but work is indexed', async () => {
    mockLearningLoop({ saved: false });
    vi.doMock('./task-outcome.js', () => ({
      persistTaskOutcome: vi.fn().mockResolvedValue({ saved: true, topic: 'Deploy staging' }),
    }));
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'Deploy staging and verify health',
      assistantText: 'Deployment finished successfully with all health checks passing.',
      toolsUsed: ['shell-exec', 'http-request', 'todo'],
      toolCallLog: [],
      sessionId: 'sess-1',
    });
    expect(result).toEqual({ kind: 'outcome', topic: 'Deploy staging' });
  });
});

describe('formatLearningNotice', () => {
  it('formats operator-visible learning notices', async () => {
    const { formatLearningNotice } = await import('./post-task-evaluator.js');
    expect(formatLearningNotice({ kind: 'skill', skillName: 'x', action: 'created' })).toContain('saved approach');
    expect(formatLearningNotice({ kind: 'skill', skillName: 'x', action: 'refined' })).toContain('correction');
    expect(formatLearningNotice({
      kind: 'preference',
      preference: 'Operator prefers concise replies',
      action: 'added',
    })).toContain('learned your preference');
    expect(formatLearningNotice({
      kind: 'protected',
      skillName: 'demo',
      reason: 'weak_evidence',
    })).toContain('kept skill');
    expect(formatLearningNotice({ kind: 'ignored', reason: 'low_confidence' })).toContain('noted your correction');
  });
});

describe('scorePreferenceConfidence', () => {
  it('blocks vague preferences', async () => {
    const { scorePreferenceConfidence } = await import('./preference-learner.js');
    expect(scorePreferenceConfidence('bad', 'wrong')).toBeLessThan(0.55);
    expect(scorePreferenceConfidence(
      'Operator prefers POST over GET for all mutation requests',
      'No, always use POST instead of GET for writes',
    )).toBeGreaterThanOrEqual(0.55);
  });
});
