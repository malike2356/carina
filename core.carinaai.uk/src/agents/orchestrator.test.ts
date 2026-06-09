import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('CarinaOrchestrator.decompose', () => {
  async function makeOrchestrator() {
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap: vi.fn().mockResolvedValue({ content: '{ "singleAgent": true, "steps": [] }' }),
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
        current: () => ({ name: 'deepseek' }),
      },
    }));
    vi.doMock('../memory/store.js', () => ({
      getSessionHistory: vi.fn().mockResolvedValue([]),
      searchMemory: vi.fn().mockResolvedValue([]),
      searchRag: vi.fn().mockResolvedValue([]),
      saveMemory: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../skills/store.js', () => ({
      findRelevantSkills: vi.fn().mockResolvedValue([]),
      incrementSkillUsage: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../skills/index.js', () => ({
      getActivePackSuffixes: vi.fn().mockReturnValue(''),
      loadPackSkills: vi.fn().mockResolvedValue(0),
    }));
    vi.doMock('../skills/auto-writer.js', () => ({
      evaluateAndWriteSkill: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../memory/persistent-memory.js', () => ({
      getAllPersistentContext: vi.fn().mockResolvedValue(''),
    }));
    vi.doMock('../tools/index.js', () => ({
      registry: { list: () => [], get: () => undefined },
      registerSessionTools: vi.fn(),
    }));
    const { CarinaOrchestrator } = await import('./orchestrator.js');
    return new CarinaOrchestrator('test-session', false);
  }

  it('returns singleAgent:true for simple question', async () => {
    const orc = await makeOrchestrator();
    const plan = await orc.decompose('What is 2 + 2?');
    expect(plan.singleAgent).toBe(true);
  });

  it('falls back to heuristic when LLM returns invalid JSON', async () => {
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap: vi.fn().mockResolvedValue({ content: 'Sorry, I cannot help.' }),
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
      },
    }));
    vi.doMock('../memory/store.js', () => ({
      getSessionHistory: vi.fn().mockResolvedValue([]),
      searchMemory: vi.fn().mockResolvedValue([]),
      searchRag: vi.fn().mockResolvedValue([]),
      saveMemory: vi.fn().mockResolvedValue(undefined),
      clearSession: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../skills/store.js', () => ({
      findRelevantSkills: vi.fn().mockResolvedValue([]),
      incrementSkillUsage: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../skills/index.js', () => ({
      getActivePackSuffixes: vi.fn().mockReturnValue(''),
    }));
    vi.doMock('../skills/auto-writer.js', () => ({
      evaluateAndWriteSkill: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../memory/persistent-memory.js', () => ({
      getAllPersistentContext: vi.fn().mockResolvedValue(''),
    }));
    vi.doMock('../tools/index.js', () => ({
      registry: { list: () => [], get: () => undefined },
      registerSessionTools: vi.fn(),
    }));
    const { CarinaOrchestrator } = await import('./orchestrator.js');
    const orc = new CarinaOrchestrator('test-session', false);
    const plan = await orc.decompose('simple question');
    expect(plan).toHaveProperty('singleAgent');
    expect(plan).toHaveProperty('steps');
  });
});
