import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('./worker-persistent-memory.js', () => ({
  addWorkerPersistentFact: vi.fn(),
  getWorkerMemoryBudgetStatus: vi.fn(async ({ target }: { target: 'user' | 'memory' }) => ({
    target,
    used: 0,
    max: target === 'user' ? 1375 : 2200,
    percent: 0,
  })),
  listWorkerPersistentFacts: vi.fn(async () => []),
  removeWorkerPersistentFact: vi.fn(async () => ({ removed: 1, ids: ['fact-1'] })),
}));

describe('aiva learning loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts durable preferences and remember statements', async () => {
    const { extractAivaLearningCandidates } = await import('./learning-loop.js');
    const candidates = extractAivaLearningCandidates({
      userMessage:
        'Remember that I prefer onboarding summaries in bullet points and always include next actions.',
      assistantReply: 'Noted.',
    });

    expect(candidates.map((c) => c.kind)).toEqual(
      expect.arrayContaining(['fact', 'preference']),
    );
    expect(candidates.some((c) => c.autoSave)).toBe(true);
  });

  it('drops secrets from learned memory candidates', async () => {
    const { extractAivaLearningCandidates } = await import('./learning-loop.js');
    const candidates = extractAivaLearningCandidates({
      userMessage: 'Remember my API key is sk-1234567890abcdefghijklmnop',
      assistantReply: 'Saved.',
    });

    expect(candidates).toHaveLength(0);
  });

  it('auto-saves next-time proactive search preferences', async () => {
    const { extractAivaLearningCandidates } = await import('./learning-loop.js');
    const candidates = extractAivaLearningCandidates({
      userMessage:
        'next time when i ask you to find something and you do not find it on one source, '
        + 'do not stop there - be proactive and search by any means necessary, starting from internal',
      assistantReply: 'Got it.',
    });
    const lesson = candidates.find((c) => c.kind === 'lesson');
    expect(lesson?.autoSave).toBe(true);
    expect(lesson?.content).toContain('internal workspace sources');
  });

  it('does not treat draft/keep-in-workspace task corrections as search preferences', async () => {
    const { extractAivaLearningCandidates } = await import('./learning-loop.js');
    const candidates = extractAivaLearningCandidates({
      userMessage: 'no, draft and keep in workspace',
      assistantReply: 'I will use memory next time.',
    });
    expect(candidates.every((c) => !String(c.content).includes('internal workspace sources'))).toBe(true);
  });

  it('does not invent lessons from assistant text on short yes confirmations', async () => {
    const { extractAivaLearningCandidates } = await import('./learning-loop.js');
    const candidates = extractAivaLearningCandidates({
      userMessage: 'yes',
      assistantReply: 'Next time I will use internal search tools first.',
    });
    expect(candidates).toHaveLength(0);
  });

  it('records repeated tool failures as operating notes', async () => {
    const { pool } = await import('../db.js');
    const { addWorkerPersistentFact } = await import('./worker-persistent-memory.js');
    vi.mocked(addWorkerPersistentFact).mockResolvedValue({
      id: 'fact-1',
      workspaceId: 'ws',
      workerId: 'worker-1',
      contactId: null,
      target: 'memory',
      content: 'Tool failed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{
        id: 'learn-1',
        workspace_id: 'ws',
        worker_id: 'worker-1',
        contact_id: null,
        channel: null,
        kind: 'tool_failure',
        content: 'Tool failed',
        confidence: 0.9,
        status: 'auto_saved',
        source_session_id: 'aiva-worker-1-workspace-owner',
        source_message: null,
        metadata_json: { target: 'memory' },
        created_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: null,
      }],
    } as never);

    const { recordAivaToolFailureLesson } = await import('./learning-loop.js');
    const item = await recordAivaToolFailureLesson({
      workspaceId: 'ws',
      workerId: 'worker-1',
      toolName: 'google-drive-search',
      sessionId: 'aiva-worker-1-workspace-owner',
      failureCount: 5,
    });

    expect(item?.kind).toBe('tool_failure');
    expect(addWorkerPersistentFact).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'memory' }),
    );
  });
});
