import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.CARINA_AUTO_SKILL;
  delete process.env.SKILL_AUTO_WRITE;
});

function mockDeps(options: {
  chatContent?: string;
  findResult?: unknown;
  getByName?: unknown;
  existsByName?: boolean;
  hasEvent?: boolean;
  preference?: { learned: boolean; action?: string };
  saveSkillError?: Error;
}) {
  vi.doMock('../brain/llm.js', () => ({
    llm: {
      chatCheap: vi.fn().mockResolvedValue({ content: options.chatContent ?? '{"save":false}' }),
    },
  }));
  vi.doMock('../memory/db.js', () => ({
    pool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    initDb: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('./store.js', () => ({
    findSkillByKeywordOverlap: vi.fn().mockResolvedValue(options.findResult ?? null),
    getSkillByName: vi.fn().mockResolvedValue(options.getByName ?? null),
    incrementSkillSuccess: vi.fn().mockResolvedValue(undefined),
    incrementSkillFailure: vi.fn().mockResolvedValue(undefined),
    saveSkill: options.saveSkillError
      ? vi.fn().mockRejectedValue(options.saveSkillError)
      : vi.fn().mockResolvedValue({ id: 'abc-123', name: 'test-skill', steps: '', trigger: [], toolsUsed: [] }),
    updateSkill: vi.fn().mockResolvedValue({ id: 'abc-123', name: 'existing', steps: 'old', trigger: [], toolsUsed: [] }),
    skillExistsByName: vi.fn().mockResolvedValue(options.existsByName ?? false),
  }));
  vi.doMock('./skill-audit-log.js', () => ({
    logSkillAction: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('./learning-events.js', () => ({
    appendLearningEvent: vi.fn().mockResolvedValue('evt-1'),
    buildLearningIdempotencyKey: vi.fn().mockReturnValue('idem-1'),
    hasLearningEvent: vi.fn().mockResolvedValue(options.hasEvent ?? false),
  }));
  vi.doMock('./skill-versions.js', () => ({
    getLatestSkillVersion: vi.fn().mockResolvedValue(0),
    recordSkillVersion: vi.fn().mockResolvedValue(1),
  }));
  vi.doMock('./preference-learner.js', () => ({
    learnPreferenceFromCorrection: vi.fn().mockResolvedValue(
      options.preference ?? { learned: false, action: 'skipped' },
    ),
  }));
}

const DRAFT_JSON = JSON.stringify({
  save: true,
  name: 'fetch-and-parse',
  description: 'Fetches a URL and parses the result',
  trigger_keywords: ['fetch', 'parse', 'url'],
  steps: '1. Fetch URL\n2. Parse JSON\n3. Return data',
  tools_used: ['http-get', 'json-parse', 'return'],
});

describe('isUserCorrection', () => {
  it('detects correction prefixes and inline signals', async () => {
    const { isUserCorrection, classifyCorrection } = await import('./learning-loop.js');
    expect(isUserCorrection('no, that was wrong')).toBe(true);
    expect(isUserCorrection('Actually you should do it differently')).toBe(true);
    expect(isUserCorrection('That is wrong, try again')).toBe(true);
    expect(isUserCorrection('Never use GET for writes')).toBe(true);
    expect(isUserCorrection('Great job, that worked!')).toBe(false);
    expect(classifyCorrection('Actually use POST').signals.length).toBeGreaterThan(0);
  });
});

describe('learning-loop helpers', () => {
  it('mergeStepsOnConflict appends correction block when steps diverge', async () => {
    const { mergeStepsOnConflict } = await import('./learning-loop.js');
    const merged = mergeStepsOnConflict(
      '1. Old approach',
      '1. New approach',
      'Actually use the API instead',
    );
    expect(merged).toContain('CORRECTION');
    expect(merged).toContain('REVISED STEPS');
    expect(merged).toContain('New approach');
  });

  it('parseSkillDraftJson handles malformed JSON', async () => {
    const { parseSkillDraftJson } = await import('./learning-loop.js');
    expect(parseSkillDraftJson('not json')).toBeNull();
    expect(parseSkillDraftJson('{"save":true,"name":"x"}')?.name).toBe('x');
  });
});

describe('runLearningLoop', () => {
  it('returns saved: false when toolsUsed.length < 3 and not a correction', async () => {
    mockDeps({});
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'do something',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('runs preference path for corrections with fewer than 3 tools', async () => {
    mockDeps({ preference: { learned: true, action: 'added' } });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'No, always use POST instead of GET',
      assistantText: 'done',
      toolsUsed: ['http-request'],
      toolCallLog: [],
      succeeded: true,
      sessionId: 'sess-1',
      tenantId: 'tenant-a',
    });
    expect(result.preferenceLearned).toBe(true);
  });

  it('dedupes repeated identical captures', async () => {
    mockDeps({ chatContent: DRAFT_JSON, hasEvent: true });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: 'Fetched and parsed successfully',
      toolsUsed: ['http-get', 'json-parse', 'return'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('saves a new skill when LLM returns valid draft and no overlap', async () => {
    mockDeps({ chatContent: DRAFT_JSON });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: 'Fetched and parsed successfully',
      toolsUsed: ['http-get', 'json-parse', 'return'],
      toolCallLog: ['http-get: {}', 'json-parse: {}', 'return: {}'],
      succeeded: true,
    });
    expect(result.saved).toBe(true);
    expect(result.action).toBe('created');
    expect(result.skillName).toBe('fetch-and-parse');
  });

  it('refines an existing skill on repeated correction', async () => {
    mockDeps({
      chatContent: DRAFT_JSON,
      findResult: { id: 'skill-1', name: 'fetch-and-parse', usageCount: 2, trigger: ['fetch'] },
      getByName: {
        id: 'skill-1',
        name: 'fetch-and-parse',
        steps: '1. Old',
        trigger: ['fetch'],
        toolsUsed: ['http-get'],
        usageCount: 2,
        successCount: 0,
        failureCount: 0,
      },
      preference: { learned: true, action: 'replaced' },
    });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'No, actually validate the JSON schema first',
      assistantText: 'done',
      toolsUsed: ['http-get', 'json-parse', 'return'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(true);
    expect(result.action).toBe('refined');
    expect(result.skillName).toBe('fetch-and-parse');
  });

  it('blocks refinement when new evidence is weaker than existing skill', async () => {
    mockDeps({
      chatContent: DRAFT_JSON,
      findResult: { id: 'skill-1', name: 'fetch-and-parse', usageCount: 10, trigger: ['fetch'] },
      getByName: {
        id: 'skill-1',
        name: 'fetch-and-parse',
        steps: '1. Old',
        trigger: ['fetch'],
        toolsUsed: ['http-get'],
        usageCount: 10,
        successCount: 8,
        failureCount: 2,
      },
    });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: "I couldn't complete the request",
      toolsUsed: ['http-get', 'json-parse', 'return'],
      toolCallLog: [],
      succeeded: false,
    });
    expect(result.saved).toBe(false);
    expect(result.action).toBe('incremented');
    expect(result.blockedReason).toBe('weak_evidence');
  });

  it('recovers from partial failure without throwing', async () => {
    mockDeps({ chatContent: DRAFT_JSON, saveSkillError: new Error('db write failed') });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: 'done',
      toolsUsed: ['a', 'b', 'c'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('returns saved: false when LLM returns save:false', async () => {
    mockDeps({ chatContent: '{"save":false}' });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: 'Fetched and parsed successfully',
      toolsUsed: ['http-get', 'json-parse', 'return'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('handles malformed evaluator JSON', async () => {
    mockDeps({ chatContent: 'Sure, here is JSON: not-valid' });
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'fetch and parse a URL',
      assistantText: 'done',
      toolsUsed: ['a', 'b', 'c'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });
});
