import {
  CarinaOrchestrator,
  isPureGreetingMessage,
  requiresSingleAgentExecution,
} from './orchestrator.js';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('isPureGreetingMessage', () => {
  it('matches short greetings only', () => {
    expect(isPureGreetingMessage('hi')).toBe(true);
    expect(isPureGreetingMessage('Hi Carina')).toBe(true);
    expect(isPureGreetingMessage('hey carin')).toBe(true);
    expect(isPureGreetingMessage('hey carin, what have you been up to lately?')).toBe(false);
    expect(isPureGreetingMessage('hello, can you check my tenants?')).toBe(false);
  });
});

describe('requiresSingleAgentExecution', () => {
  it('honours explicit no-delegation instructions for worker-scoped tools', () => {
    expect(requiresSingleAgentExecution('Do NOT delegate to a subagent.')).toBe(true);
    expect(requiresSingleAgentExecution('Complete this without delegating.')).toBe(true);
    expect(requiresSingleAgentExecution('Research this with specialist agents.')).toBe(false);
  });
});

describe('CarinaOrchestrator.decompose', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });
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

describe('CarinaOrchestrator fast lane', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('answers greetings without calling the planner', async () => {
    const chatCheap = vi.fn();
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap,
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
        current: () => ({ name: 'deepseek' }),
        currentModel: () => 'deepseek-chat',
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
    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of orc.turn('Hi Carina')) {
      events.push(event);
    }

    expect(chatCheap).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        type: 'text',
        content: 'Hi.',
      },
    ]);
  });

  it('answers capability questions in one compact line', async () => {
    const chatCheap = vi.fn();
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap,
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
        current: () => ({ name: 'deepseek' }),
        currentModel: () => 'deepseek-chat',
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
    const orc = new CarinaOrchestrator('test-session', false, undefined, { platform: 'telegram' });
    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of orc.turn('what can you do?')) {
      events.push(event);
    }

    expect(chatCheap).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('text');
    const content = events[0]?.content ?? '';
    expect(content.toLowerCase()).toMatch(/chat/);
    expect(content.toLowerCase()).not.toMatch(/trello|calendar|documents editor/);
  });

  it('answers robot or identity questions without calling the model', async () => {
    const chatCheap = vi.fn();
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap,
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
        current: () => ({ name: 'deepseek' }),
        currentModel: () => 'deepseek-chat',
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
    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of orc.turn('is carina a robot?')) {
      events.push(event);
    }

    expect(chatCheap).not.toHaveBeenCalled();
    expect(events[0]?.content).toContain('AI agent');

    const identityEvents: Array<{ type: string; content?: string }> = [];
    for await (const event of orc.turn('who am I?')) {
      identityEvents.push(event);
    }
    expect(identityEvents[0]?.content).toContain('person I am assisting');
  });

  it('answers capability typos before identity quick reply', async () => {
    const chatCheap = vi.fn();
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        chatCheap,
        stream: async function* () { yield 'done'; },
        list: () => ['deepseek'],
        current: () => ({ name: 'deepseek' }),
        currentModel: () => 'deepseek-chat',
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
    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of orc.turn('what are you capabilities?')) {
      events.push(event);
    }

    expect(chatCheap).not.toHaveBeenCalled();
    expect(events[0]?.content).toContain('Ask me how to use any of them');
    expect(events[0]?.content).not.toContain('physical robot');
  });
});
