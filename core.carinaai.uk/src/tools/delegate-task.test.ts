import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDelegateTaskTool, setDelegationDepth } from './delegate-task.js';
import { resolveToolset } from './toolset.js';
import { resetDelegationState } from '../agents/delegation-context.js';

const runDelegatedTaskMock = vi.fn().mockResolvedValue('subagent summary');

vi.mock('../agents/subagent-runner.js', () => ({
  runDelegatedTask: (...args: unknown[]) => runDelegatedTaskMock(...args),
}));

beforeEach(() => {
  resetDelegationState();
  runDelegatedTaskMock.mockReset();
  runDelegatedTaskMock.mockResolvedValue('subagent summary');
});

describe('delegate-task tool', () => {
  const sessionId = 'delegate-test';

  it('returns error when depth limit reached', async () => {
    setDelegationDepth(sessionId, 1);
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({ goal: 'test task', _sessionId: sessionId }) as { error?: string };
    expect(result.error).toContain('Delegation depth limit');
  });

  it('runs single task mode in a worker thread', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      goal: 'check disk usage',
      context: 'Project at /tmp',
      toolsets: ['terminal'],
      _sessionId: sessionId,
    }) as { mode: string; summary: string; delegatedTo: string };
    expect(result.mode).toBe('single');
    expect(result.summary).toBe('subagent summary');
    expect(result.delegatedTo).toBe('worker_thread');
    expect(runDelegatedTaskMock).toHaveBeenCalledOnce();
  });

  it('runs batch mode with multiple tasks', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      tasks: [
        { goal: 'task A', toolsets: ['terminal'] },
        { goal: 'task B', toolsets: ['file'] },
        { goal: 'task C', toolsets: ['web'] },
      ],
      _sessionId: sessionId,
    }) as { mode: string; taskCount: number; results: string[]; delegatedTo: string };
    expect(result.mode).toBe('batch');
    expect(result.taskCount).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.delegatedTo).toBe('worker_thread');
    expect(runDelegatedTaskMock).toHaveBeenCalledTimes(3);
  });

  it('rejects leaf tools in toolsets', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      goal: 'do something',
      toolsets: ['terminal', 'memory'],
      _sessionId: sessionId,
    }) as { error?: string };
    expect(result.error).toContain('memory');
  });

  it('excludes delegate-task from resolved toolsets', () => {
    const tools = resolveToolset(['terminal', 'delegate-task']);
    expect(tools).not.toContain('delegate-task');
  });

  it('returns error when goal and tasks are both absent', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({ _sessionId: sessionId }) as { error?: string };
    expect(result.error).toContain('goal or tasks is required');
  });

  it('isolates failures - one bad batch task does not kill others', async () => {
    let callCount = 0;
    runDelegatedTaskMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) throw new Error('subagent exploded');
      return 'ok';
    });

    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      tasks: [
        { goal: 'task A', toolsets: ['terminal'] },
        { goal: 'task B', toolsets: ['terminal'] },
        { goal: 'task C', toolsets: ['terminal'] },
      ],
      _sessionId: sessionId,
    }) as { results: string[] };

    expect(result.results).toHaveLength(3);
    const errorTask = result.results.find((r) => r.startsWith('Error:'));
    expect(errorTask).toBeDefined();
    const successTasks = result.results.filter((r) => r === 'ok');
    expect(successTasks).toHaveLength(2);
  });

  it('rejects leaf tool in a batch task and returns error in results', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      tasks: [
        { goal: 'task A', toolsets: ['terminal'] },
        { goal: 'task B', toolsets: ['clarify'] },
      ],
      _sessionId: sessionId,
    }) as { results: string[] };

    expect(result.results[0]).toBe('subagent summary');
    expect(result.results[1]).toContain('Error');
  });

  it('runs at most MAX_CONCURRENT_SUBAGENTS tasks simultaneously', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      tasks: [
        { goal: 'task 1', toolsets: ['terminal'] },
        { goal: 'task 2', toolsets: ['terminal'] },
        { goal: 'task 3', toolsets: ['terminal'] },
        { goal: 'task 4', toolsets: ['terminal'] },
        { goal: 'task 5', toolsets: ['terminal'] },
      ],
      _sessionId: sessionId,
    }) as { taskCount: number; concurrency: number; results: string[] };

    expect(result.taskCount).toBe(5);
    expect(result.concurrency).toBe(3);
    expect(result.results).toHaveLength(5);
  });

  it('passes timeoutSeconds to the worker runner', async () => {
    const tool = createDelegateTaskTool(sessionId);
    await tool.execute({
      goal: 'quick task',
      timeoutSeconds: 30,
      _sessionId: sessionId,
    });

    expect(runDelegatedTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 30_000,
      }),
    );
  });
});

describe('runDelegatedTask export', () => {
  it('re-exports the worker runner helper', async () => {
    const { runDelegatedTask } = await import('./delegate-task.js');
    expect(runDelegatedTask).toBeTypeOf('function');
  });
});
