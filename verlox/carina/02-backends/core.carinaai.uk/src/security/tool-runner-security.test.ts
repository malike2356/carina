import { describe, expect, it, vi, beforeEach } from 'vitest';
import { _resetSecurityAuditForTests } from './security-audit.js';

describe('tool-runner security gating', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv('CARINA_APPROVAL_POLICY', 'off');
    vi.stubEnv('LABYRINTH_ENABLED', 'false');
    _resetSecurityAuditForTests();
  });

  it('denies shell-exec for viewer role', async () => {
    const attestCriticalSecurityEvent = vi.fn(async () => undefined);
    const mockTool = {
      name: 'shell-exec',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn(),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
      getSessionTool: () => undefined,
    }));
    vi.doMock('./critical-event-attestation.js', () => ({
      attestCriticalSecurityEvent,
    }));

    const ctxMod = await import('./tool-execution-context.js');
    const { executeToolCall } = await import('../agents/tool-runner.js');
    const result = await ctxMod.runWithToolExecutionContextAsync({ orgRole: 'viewer' }, () =>
      executeToolCall({
        type: 'tool_call',
        toolName: 'shell-exec',
        toolCallId: 'id-1',
        params: { command: 'echo hi' },
      }),
    );

    expect(result).toMatchObject({ code: 'TOOL_RBAC_DENIED' });
    expect(mockTool.execute).not.toHaveBeenCalled();
    expect(attestCriticalSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
      category: 'tool_rbac',
      action: 'deny',
      toolName: 'shell-exec',
      severity: 'critical',
    }));
  });

  it('passes sandbox mode into tool params', async () => {
    const mockTool = {
      name: 'test-tool',
      description: '',
      parameters: {},
      execute: vi.fn().mockResolvedValue('ok'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
      getSessionTool: () => undefined,
    }));

    const { executeToolCall } = await import('../agents/tool-runner.js');
    await executeToolCall({
      type: 'tool_call',
      toolName: 'test-tool',
      toolCallId: 'id-1',
      params: {},
    });

    expect(mockTool.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        _sessionId: 'default-session',
        _sandboxMode: expect.any(String),
      }),
    );
  });
});
