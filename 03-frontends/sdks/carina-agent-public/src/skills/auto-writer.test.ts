import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SkillWriteInput } from './auto-writer.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function input(overrides: Partial<SkillWriteInput> = {}): SkillWriteInput {
  return {
    userMessage: 'calculate yield on a property',
    response: 'The gross yield is 7.2%',
    toolsUsed: ['code-exec'],
    toolCallLog: ['code-exec: {code:"..."}'],
    multiStep: false,
    ...overrides,
  };
}

// Mock all transitive dependencies that have module-level side effects
function mockDeps(skillAutoWrite: boolean, chatCheapImpl?: () => Promise<{ content: string }>) {
  vi.doMock('../config/index.js', () => ({
    config: {
      carina: { skillAutoWrite, defaultProvider: 'deepseek' },
      anthropic: { apiKey: '', model: 'claude-sonnet-4-6' },
      openai: { apiKey: '' },
      deepseek: { apiKey: '' },
      database: { url: 'postgresql://localhost/test' },
      redis: { url: 'redis://localhost' },
    },
  }));
  vi.doMock('../brain/llm.js', () => ({
    llm: {
      chatCheap: chatCheapImpl ?? vi.fn().mockResolvedValue({ content: '{"save":false}' }),
      list: () => ['deepseek'],
    },
  }));
  vi.doMock('../memory/db.js', () => ({
    pool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    initDb: vi.fn().mockResolvedValue(undefined),
  }));
}

function mockStore(overrides: Record<string, unknown> = {}) {
  vi.doMock('./store.js', () => ({
    findSkillByKeywordOverlap: vi.fn().mockResolvedValue(null),
    saveSkill: vi.fn().mockResolvedValue({}),
    incrementSkillUsage: vi.fn().mockResolvedValue(undefined),
    listSkills: vi.fn().mockResolvedValue([]),
    ...overrides,
  }));
}

describe('evaluateAndWriteSkill', () => {
  it('does nothing when skillAutoWrite is false', async () => {
    const chatCheap = vi.fn();
    mockDeps(false, chatCheap);
    mockStore();
    const { evaluateAndWriteSkill } = await import('./auto-writer.js');
    await evaluateAndWriteSkill(input());
    expect(chatCheap).not.toHaveBeenCalled();
  });

  it('skips evaluation when no tools used and not multi-step', async () => {
    const chatCheap = vi.fn();
    mockDeps(true, chatCheap);
    mockStore();
    const { evaluateAndWriteSkill } = await import('./auto-writer.js');
    await evaluateAndWriteSkill(input({ toolsUsed: [], multiStep: false }));
    expect(chatCheap).not.toHaveBeenCalled();
  });

  it('calls LLM for evaluation when tools were used', async () => {
    const chatCheap = vi.fn().mockResolvedValue({ content: '{"save":false}' });
    mockDeps(true, chatCheap);
    mockStore();
    const { evaluateAndWriteSkill } = await import('./auto-writer.js');
    await evaluateAndWriteSkill(input({ toolsUsed: ['code-exec'] }));
    expect(chatCheap).toHaveBeenCalled();
  });

  it('saves skill when LLM returns save:true', async () => {
    const skillDraft = {
      save: true,
      name: 'yield-calc',
      description: 'Calculate property yield',
      trigger_keywords: ['yield', 'roi'],
      steps: '1. Get price\n2. Get rent',
      tools_used: ['code-exec'],
    };
    const chatCheap = vi.fn().mockResolvedValue({ content: JSON.stringify(skillDraft) });
    mockDeps(true, chatCheap);
    const saveSkill = vi.fn().mockResolvedValue({});
    mockStore({ saveSkill });
    const { evaluateAndWriteSkill } = await import('./auto-writer.js');
    await evaluateAndWriteSkill(input({ toolsUsed: ['code-exec'] }));
    expect(saveSkill).toHaveBeenCalledWith(expect.objectContaining({ name: 'yield-calc' }));
  });

  it('increments usage count instead of saving when duplicate exists', async () => {
    const existing = { id: 'existing-id', name: 'yield-calc', trigger: ['yield'] };
    const skillDraft = {
      save: true,
      name: 'yield-calc-2',
      trigger_keywords: ['yield'],
      description: 'x',
      steps: '1.',
      tools_used: [],
    };
    const chatCheap = vi.fn().mockResolvedValue({ content: JSON.stringify(skillDraft) });
    mockDeps(true, chatCheap);
    const saveSkill = vi.fn();
    const incrementSkillUsage = vi.fn().mockResolvedValue(undefined);
    mockStore({
      findSkillByKeywordOverlap: vi.fn().mockResolvedValue(existing),
      saveSkill,
      incrementSkillUsage,
    });
    const { evaluateAndWriteSkill } = await import('./auto-writer.js');
    await evaluateAndWriteSkill(input({ toolsUsed: ['code-exec'] }));
    expect(saveSkill).not.toHaveBeenCalled();
    expect(incrementSkillUsage).toHaveBeenCalledWith('existing-id');
  });
});
