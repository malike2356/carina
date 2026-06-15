import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockLearningLoop(result: unknown) {
  vi.doMock('./learning-loop.js', () => ({
    runLearningLoop: vi.fn().mockResolvedValue(result),
    isUserCorrection: vi.fn().mockReturnValue(false),
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
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a thing',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: [],
    });
    expect(result).toBeNull();
  });

  it('returns skillName when learning loop creates a skill', async () => {
    mockLearningLoop({ saved: true, skillName: 'my-new-skill', action: 'created' });
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a multi-step thing',
      assistantText: 'completed successfully',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: ['tool1: {}', 'tool2: {}', 'tool3: {}'],
    });
    expect(result).toBe('my-new-skill');
  });

  it('returns null when action is refined (not created)', async () => {
    mockLearningLoop({ saved: true, skillName: 'existing-skill', action: 'refined' });
    const { evaluateAfterTurn } = await import('./post-task-evaluator.js');
    const result = await evaluateAfterTurn({
      userMessage: 'do a thing',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: [],
    });
    expect(result).toBeNull();
  });
});
