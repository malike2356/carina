import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../memory/store.js', () => ({
  saveMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./learning-events.js', () => ({
  appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
  buildLearningIdempotencyKey: vi.fn().mockReturnValue('abc123'),
  hasLearningEvent: vi.fn().mockResolvedValue(false),
}));

describe('task-outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CARINA_TASK_OUTCOMES;
  });

  it('distills compact outcome text from multi-tool turns', async () => {
    const { distillTaskOutcome } = await import('./task-outcome.js');
    const distilled = distillTaskOutcome({
      userMessage: 'Deploy the staging stack and verify health checks',
      assistantText: 'Deployment finished. All pods are healthy and the ingress responds with 200.',
      toolsUsed: ['shell-exec', 'http-request', 'file-read'],
    });
    expect(distilled?.topic).toContain('Deploy');
    expect(distilled?.body).toContain('[task-outcome]');
    expect(distilled?.body).toContain('shell-exec');
  });

  it('skips low-signal turns', async () => {
    const { distillTaskOutcome } = await import('./task-outcome.js');
    expect(distillTaskOutcome({
      userMessage: 'hi',
      assistantText: 'ok',
      toolsUsed: ['a', 'b', 'c'],
    })).toBeNull();
  });

  it('persists session outcome and logs learning event', async () => {
    const { persistTaskOutcome } = await import('./task-outcome.js');
    const { saveMemory } = await import('../memory/store.js');
    const { appendLearningEvent } = await import('./learning-events.js');

    const result = await persistTaskOutcome({
      sessionId: 'sess-1',
      tenantId: '__operator__',
      userMessage: 'Run database migration and smoke test',
      assistantText: 'Migration applied successfully. Smoke tests passed for read and write paths.',
      toolsUsed: ['shell-exec', 'memory', 'todo'],
    });

    expect(result.saved).toBe(true);
    expect(saveMemory).toHaveBeenCalledOnce();
    expect(appendLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'task_outcome_saved', sessionId: 'sess-1' }),
    );
  });

  it('respects CARINA_TASK_OUTCOMES=false', async () => {
    process.env.CARINA_TASK_OUTCOMES = 'false';
    const { persistTaskOutcome } = await import('./task-outcome.js');
    const result = await persistTaskOutcome({
      sessionId: 'sess-1',
      userMessage: 'Long task',
      assistantText: 'Completed with enough detail to qualify for indexing in session search.',
      toolsUsed: ['a', 'b', 'c'],
    });
    expect(result.saved).toBe(false);
    expect(result.reason).toBe('disabled');
  });
});
