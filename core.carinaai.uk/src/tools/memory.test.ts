import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../memory/persistent-memory.js', () => ({
  MEMORY_BUDGETS: { user: 1375, memory: 2200 },
  addPersistentFact: vi.fn(),
  removePersistentFact: vi.fn(),
  replacePersistentFact: vi.fn(),
  listPersistentFacts: vi.fn(),
}));

import * as pm from '../memory/persistent-memory.js';

const addMock = vi.mocked(pm.addPersistentFact);
const removeMock = vi.mocked(pm.removePersistentFact);
const replaceMock = vi.mocked(pm.replacePersistentFact);
const listMock = vi.mocked(pm.listPersistentFacts);

const fakeFact = (content = 'test') => ({
  id: 'uuid-1',
  target: 'memory' as const,
  content,
  createdAt: new Date('2026-01-01'),
});

describe('memory tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
  });

  it('add: returns added status and budget', async () => {
    addMock.mockResolvedValue(fakeFact('hello'));
    listMock.mockResolvedValue([fakeFact('hello')]);
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'add', target: 'memory', content: 'hello' });
    expect(result).toMatchObject({ status: 'added', id: 'uuid-1', target: 'memory' });
    expect((result as { budget: { used: number } }).budget.used).toBe(5);
  });

  it('add: returns error when content is empty', async () => {
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'add', target: 'memory', content: '' });
    expect(result).toMatchObject({ error: 'content is required for add' });
    expect(addMock).not.toHaveBeenCalled();
  });

  it('add: returns error object when addPersistentFact throws', async () => {
    addMock.mockRejectedValue(new Error('Memory budget exceeded'));
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'add', target: 'user', content: 'x' });
    expect(result).toMatchObject({ error: 'Memory budget exceeded' });
  });

  it('list: returns facts and budget', async () => {
    listMock.mockResolvedValue([fakeFact('note one'), fakeFact('note two')]);
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'list', target: 'memory' });
    expect(result).toMatchObject({ target: 'memory', count: 2 });
    expect((result as { facts: unknown[] }).facts).toHaveLength(2);
  });

  it('replace: returns replaced status', async () => {
    replaceMock.mockResolvedValue(fakeFact('new text'));
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({
      action: 'replace', target: 'memory', old_text: 'old', content: 'new text',
    });
    expect(result).toMatchObject({ status: 'replaced' });
  });

  it('replace: returns error when old_text is empty', async () => {
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'replace', target: 'memory', content: 'x' });
    expect(result).toMatchObject({ error: 'old_text is required for replace' });
  });

  it('replace: returns error when replacePersistentFact throws', async () => {
    replaceMock.mockRejectedValue(new Error('No memory entry matching "foo"'));
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({
      action: 'replace', target: 'memory', old_text: 'foo', content: 'bar',
    });
    expect(result).toMatchObject({ error: 'No memory entry matching "foo"' });
  });

  it('remove: returns removed status', async () => {
    removeMock.mockResolvedValue(true);
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'remove', target: 'memory', old_text: 'to delete' });
    expect(result).toMatchObject({ status: 'removed' });
  });

  it('remove: returns error when old_text is empty', async () => {
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'remove', target: 'memory' });
    expect(result).toMatchObject({ error: 'old_text is required for remove' });
  });

  it('remove: returns error when removePersistentFact throws', async () => {
    removeMock.mockRejectedValue(new Error('No memory entry matching "ghost"'));
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'remove', target: 'memory', old_text: 'ghost' });
    expect(result).toMatchObject({ error: 'No memory entry matching "ghost"' });
  });

  it('unknown action returns error', async () => {
    const { memoryTool } = await import('./memory.js');
    const result = await memoryTool.execute({ action: 'noop', target: 'memory' });
    expect(result).toMatchObject({ error: 'Unknown action: noop' });
  });

  it('defaults target to memory when not user', async () => {
    addMock.mockResolvedValue(fakeFact('x'));
    listMock.mockResolvedValue([]);
    const { memoryTool } = await import('./memory.js');
    await memoryTool.execute({ action: 'add', target: 'other', content: 'x' });
    expect(addMock).toHaveBeenCalledWith('memory', 'x');
  });
});
