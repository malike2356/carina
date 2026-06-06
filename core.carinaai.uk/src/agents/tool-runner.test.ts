import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeToolCall } from './tool-runner.js';
import type { ToolCall } from '../types/index.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function makeCall(toolName: string, params: Record<string, unknown> = {}): ToolCall {
  return { type: 'tool_call', toolName, toolCallId: 'id-1', params };
}

describe('executeToolCall', () => {
  it('returns error for unknown tool', async () => {
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => undefined },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const result = await exec(makeCall('nonexistent'));
    expect(result).toMatchObject({ error: expect.stringContaining('Unknown tool') });
  });

  it('executes tool and returns result', async () => {
    const mockTool = {
      name: 'test-tool',
      description: '',
      parameters: {},
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const result = await exec(makeCall('test-tool', { x: 1 }));
    expect(result).toMatchObject({ ok: true });
    expect(mockTool.execute).toHaveBeenCalledWith({ x: 1 });
  });

  it('calls confirm handler before dangerous tool and aborts on denial', async () => {
    const mockTool = {
      name: 'dangerous-tool',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn().mockResolvedValue('done'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const confirm = vi.fn().mockResolvedValue(false);
    const result = await exec(makeCall('dangerous-tool'), confirm);
    expect(confirm).toHaveBeenCalled();
    expect(result).toMatchObject({ error: expect.stringContaining('declined') });
    expect(mockTool.execute).not.toHaveBeenCalled();
  });

  it('proceeds when confirm handler approves', async () => {
    const mockTool = {
      name: 'confirm-tool',
      description: '',
      parameters: {},
      requiresConfirmation: true,
      execute: vi.fn().mockResolvedValue('success'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const confirm = vi.fn().mockResolvedValue(true);
    const result = await exec(makeCall('confirm-tool'), confirm);
    expect(result).toBe('success');
  });

  it('returns error when no confirm handler for dangerous tool', async () => {
    const mockTool = {
      name: 'no-confirm-tool',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn(),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const result = await exec(makeCall('no-confirm-tool'));
    expect(result).toMatchObject({ error: expect.stringContaining('confirm') });
  });

  it('catches and returns execute errors', async () => {
    const mockTool = {
      name: 'throwing-tool',
      description: '',
      parameters: {},
      execute: vi.fn().mockRejectedValue(new Error('network failure')),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
    }));
    const { executeToolCall: exec } = await import('./tool-runner.js');
    const result = await exec(makeCall('throwing-tool'));
    expect(result).toMatchObject({ error: 'network failure' });
  });
});
