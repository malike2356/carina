import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('tool-policy-middleware disabled', () => {
  const originalEnabled = process.env.LABYRINTH_ENABLED;

  beforeEach(() => {
    vi.resetModules();
    process.env.LABYRINTH_ENABLED = 'false';
  });

  afterEach(() => {
    process.env.LABYRINTH_ENABLED = originalEnabled;
    vi.restoreAllMocks();
  });

  it('enforceToolPolicy is a no-op when Labyrinth is disabled', async () => {
    const { enforceToolPolicy, _resetToolPolicyEnforcer } = await import('./tool-policy-middleware.js');
    _resetToolPolicyEnforcer();
    const result = await enforceToolPolicy('shell-exec', { command: 'rm -rf /' }, 'session-1');
    expect(result).toBeNull();
  });

  it('does not call ToolPolicyEnforcer.enforce when Labyrinth is disabled', async () => {
    const { ToolPolicyEnforcer } = await import('./tool-policy.js');
    const enforceSpy = vi.spyOn(ToolPolicyEnforcer.prototype, 'enforce');

    const mockTool = {
      name: 'mock-safe-tool',
      description: '',
      parameters: {},
      execute: vi.fn().mockResolvedValue('ok'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));

    const { executeToolCall } = await import('../agents/tool-runner.js');
    const result = await executeToolCall({
      type: 'tool_call',
      toolName: 'mock-safe-tool',
      toolCallId: 'id-1',
      params: { command: 'echo hi' },
    });

    expect(result).toBe('ok');
    expect(mockTool.execute).toHaveBeenCalled();
    expect(enforceSpy).not.toHaveBeenCalled();
  });
});
