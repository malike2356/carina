import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createDelegateTaskTool, setDelegationDepth } from './delegate-task.js';
import { resolveToolset } from './toolset.js';
import { resetDelegationState } from '../agents/delegation-context.js';

const runMock = vi.fn().mockResolvedValue('subagent summary');

vi.mock('../agents/generic-sub-agent.js', () => ({
  GenericSubAgent: class {
    async run() {
      return runMock();
    }
  },
}));

beforeEach(() => {
  resetDelegationState();
  runMock.mockClear();
});

describe('delegate-task tool', () => {
  const sessionId = 'delegate-test';

  it('returns error when depth limit reached', async () => {
    setDelegationDepth(sessionId, 1);
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({ goal: 'test task', _sessionId: sessionId }) as { error?: string };
    expect(result.error).toContain('Delegation depth limit');
  });

  it('runs single task mode', async () => {
    const tool = createDelegateTaskTool(sessionId);
    const result = await tool.execute({
      goal: 'check disk usage',
      context: 'Project at /tmp',
      toolsets: ['terminal'],
      _sessionId: sessionId,
    }) as { mode: string; summary: string };
    expect(result.mode).toBe('single');
    expect(result.summary).toBe('subagent summary');
    expect(runMock).toHaveBeenCalledOnce();
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
    }) as { mode: string; taskCount: number; results: string[] };
    expect(result.mode).toBe('batch');
    expect(result.taskCount).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(runMock).toHaveBeenCalledTimes(3);
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
});
