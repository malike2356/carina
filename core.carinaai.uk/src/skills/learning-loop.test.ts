import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isUserCorrection } from './learning-loop.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.CARINA_AUTO_SKILL;
  delete process.env.SKILL_AUTO_WRITE;
});

function mockLlmAndStore(chatContent: string, findResult: unknown = null) {
  vi.doMock('../brain/llm.js', () => ({
    llm: { chatCheap: vi.fn().mockResolvedValue({ content: chatContent }) },
  }));
  vi.doMock('../memory/db.js', () => ({
    pool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    initDb: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('./store.js', () => ({
    findSkillByKeywordOverlap: vi.fn().mockResolvedValue(findResult),
    getSkillByName: vi.fn().mockResolvedValue(null),
    incrementSkillSuccess: vi.fn().mockResolvedValue(undefined),
    incrementSkillFailure: vi.fn().mockResolvedValue(undefined),
    saveSkill: vi.fn().mockResolvedValue({ id: 'abc-123', name: 'test-skill' }),
    updateSkill: vi.fn().mockResolvedValue({}),
  }));
  vi.doMock('./skill-audit-log.js', () => ({
    logSkillAction: vi.fn().mockResolvedValue(undefined),
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
  it('detects "no," prefix', () => {
    expect(isUserCorrection('no, that was wrong')).toBe(true);
  });

  it('detects "actually" prefix', () => {
    expect(isUserCorrection('Actually you should do it differently')).toBe(true);
  });

  it('detects "wrong," inline', () => {
    expect(isUserCorrection("That is wrong, try again")).toBe(true);
  });

  it('returns false for affirmative messages', () => {
    expect(isUserCorrection('Great job, that worked!')).toBe(false);
    expect(isUserCorrection('Yes please continue')).toBe(false);
  });
});

describe('runLearningLoop', () => {
  it('returns saved: false when toolsUsed.length < 3', async () => {
    mockLlmAndStore('{}');
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

  it('returns saved: false when CARINA_AUTO_SKILL=false', async () => {
    process.env.CARINA_AUTO_SKILL = 'false';
    mockLlmAndStore(DRAFT_JSON);
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'do something',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('returns saved: false when SKILL_AUTO_WRITE=false', async () => {
    process.env.SKILL_AUTO_WRITE = 'false';
    mockLlmAndStore(DRAFT_JSON);
    const { runLearningLoop } = await import('./learning-loop.js');
    const result = await runLearningLoop({
      userMessage: 'do something',
      assistantText: 'done',
      toolsUsed: ['tool1', 'tool2', 'tool3'],
      toolCallLog: [],
      succeeded: true,
    });
    expect(result.saved).toBe(false);
  });

  it('saves a new skill when LLM returns valid draft and no overlap', async () => {
    mockLlmAndStore(DRAFT_JSON, null);
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

  it('returns saved: false when LLM returns save:false', async () => {
    mockLlmAndStore('{"save":false}');
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
});
