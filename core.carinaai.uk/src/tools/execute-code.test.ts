import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.stubEnv('CARINA_APPROVAL_POLICY', 'off');
});

describe('detectLanguage', () => {
  it('detects python from def, import, from, and print(', async () => {
    const { detectLanguage } = await import('./execute-code.js');
    expect(detectLanguage('def main():\n  pass')).toBe('python');
    expect(detectLanguage('import os')).toBe('python');
    expect(detectLanguage('from pathlib import Path')).toBe('python');
    expect(detectLanguage('print("hi")')).toBe('python');
  });

  it('detects javascript for typical JS snippets', async () => {
    const { detectLanguage } = await import('./execute-code.js');
    expect(detectLanguage('1 + 1')).toBe('javascript');
    expect(detectLanguage('console.log("hi")')).toBe('javascript');
    expect(detectLanguage('const x = 42;')).toBe('javascript');
  });
});

describe('execute-code bridge', () => {
  async function makeBridgeDir(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'carina-bridge-'));
  }

  it('services a request file and writes a response with result', async () => {
    const bridgeDir = await makeBridgeDir();
    const callId = 'call-1';
    const requestPath = path.join(bridgeDir, `${callId}.request.json`);
    await fs.writeFile(
      requestPath,
      JSON.stringify({ tool: 'mock-tool', params: { path: '/tmp/x' } }),
      'utf8',
    );

    const executeToolCall = vi.fn().mockResolvedValue({ content: 'hello' });
    vi.doMock('../agents/tool-runner.js', () => ({ executeToolCall }));

    const { processBridgeRequest } = await import('./execute-code.js');
    const state = { callCount: 0, limitExceeded: false, stopped: false };
    await processBridgeRequest(
      bridgeDir,
      requestPath,
      { sessionId: 'test-session' },
      state,
    );

    const responseRaw = await fs.readFile(path.join(bridgeDir, `${callId}.response.json`), 'utf8');
    const response = JSON.parse(responseRaw) as { result: { content: string } };
    expect(response.result.content).toBe('hello');
    expect(executeToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'mock-tool',
        params: { path: '/tmp/x' },
      }),
      undefined,
      false,
      'test-session',
    );
    expect(state.callCount).toBe(1);
  });

  it('writes error response when tool call limit is exceeded', async () => {
    const bridgeDir = await makeBridgeDir();
    const callId = 'limit-call';
    const requestPath = path.join(bridgeDir, `${callId}.request.json`);
    await fs.writeFile(
      requestPath,
      JSON.stringify({ tool: 'file-read', params: { path: '/tmp/x' } }),
      'utf8',
    );

    vi.doMock('../agents/tool-runner.js', () => ({
      executeToolCall: vi.fn().mockResolvedValue({ content: 'unused' }),
    }));

    const { processBridgeRequest, MAX_BRIDGE_TOOL_CALLS } = await import('./execute-code.js');
    const state = {
      callCount: MAX_BRIDGE_TOOL_CALLS,
      limitExceeded: false,
      stopped: false,
    };
    await processBridgeRequest(
      bridgeDir,
      requestPath,
      { sessionId: 'test-session' },
      state,
    );

    const responseRaw = await fs.readFile(path.join(bridgeDir, `${callId}.response.json`), 'utf8');
    const response = JSON.parse(responseRaw) as { error: string };
    expect(response.error).toBe('tool call limit exceeded');
    expect(state.limitExceeded).toBe(true);
  });

  it('requires confirmation for dangerous bridged tools without confirm handler', async () => {
    const bridgeDir = await makeBridgeDir();
    const callId = 'danger-call';
    const requestPath = path.join(bridgeDir, `${callId}.request.json`);
    await fs.writeFile(
      requestPath,
      JSON.stringify({ tool: 'dangerous-bridge-tool', params: { x: 1 } }),
      'utf8',
    );

    const dangerousTool = {
      name: 'dangerous-bridge-tool',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn().mockResolvedValue('should-not-run'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: {
        get: (name: string) => (name === dangerousTool.name ? dangerousTool : undefined),
      },
      getSessionTool: () => undefined,
    }));
    vi.doMock('../agents/tool-runner.js', async () => vi.importActual('../agents/tool-runner.js'));

    const { processBridgeRequest } = await import('./execute-code.js');
    const state = { callCount: 0, limitExceeded: false, stopped: false };
    await processBridgeRequest(
      bridgeDir,
      requestPath,
      { sessionId: 'test-session' },
      state,
    );

    const responseRaw = await fs.readFile(path.join(bridgeDir, `${callId}.response.json`), 'utf8');
    const response = JSON.parse(responseRaw) as { error: string };
    expect(response.error).toContain('confirm');
    expect(dangerousTool.execute).not.toHaveBeenCalled();
  });

  it('writes error response for unknown tool name', async () => {
    const bridgeDir = await makeBridgeDir();
    const callId = 'unknown-tool-call';
    const requestPath = path.join(bridgeDir, `${callId}.request.json`);
    await fs.writeFile(
      requestPath,
      JSON.stringify({ tool: 'nonexistent-tool-xyz', params: {} }),
      'utf8',
    );

    vi.doMock('../agents/tool-runner.js', () => ({
      executeToolCall: vi.fn().mockRejectedValue(new Error('Tool not found: nonexistent-tool-xyz')),
    }));

    const { processBridgeRequest } = await import('./execute-code.js');
    const state = { callCount: 0, limitExceeded: false, stopped: false };
    await processBridgeRequest(bridgeDir, requestPath, { sessionId: 'test-session' }, state);

    const responseRaw = await fs.readFile(
      path.join(bridgeDir, `${callId}.response.json`),
      'utf8',
    );
    const response = JSON.parse(responseRaw) as { error: string };
    expect(response.error).toContain('nonexistent-tool-xyz');
    expect(state.callCount).toBe(1);
  });

  it('rejects shell-exec background and pty params via bridge', async () => {
    const bridgeDir = await makeBridgeDir();
    const executeToolCall = vi.fn();
    vi.doMock('../agents/tool-runner.js', () => ({ executeToolCall }));

    const { processBridgeRequest } = await import('./execute-code.js');
    const state = { callCount: 0, limitExceeded: false, stopped: false };

    for (const [callId, params] of [
      ['bg-call', { command: 'sleep 1', background: true }],
      ['pty-call', { command: 'vim', pty: true }],
    ] as const) {
      const requestPath = path.join(bridgeDir, `${callId}.request.json`);
      await fs.writeFile(
        requestPath,
        JSON.stringify({ tool: 'shell-exec', params }),
        'utf8',
      );
      await processBridgeRequest(
        bridgeDir,
        requestPath,
        { sessionId: 'test-session' },
        state,
      );
      const responseRaw = await fs.readFile(path.join(bridgeDir, `${callId}.response.json`), 'utf8');
      const response = JSON.parse(responseRaw) as { error: string };
      expect(response.error).toMatch(/not allowed via code-exec bridge/);
    }

    expect(executeToolCall).not.toHaveBeenCalled();
  });
});

describe('truncateCodeOutput', () => {
  it('truncates stdout beyond 50KB with file-read style message', async () => {
    const { truncateCodeOutput, MAX_BRIDGE_OUTPUT_BYTES } = await import('./execute-code.js');
    const big = 'x'.repeat(MAX_BRIDGE_OUTPUT_BYTES + 100);
    const truncated = truncateCodeOutput(big);
    expect(truncated).toContain('[truncated: output exceeded');
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(MAX_BRIDGE_OUTPUT_BYTES + 200);
  });
});

describe('runCodeWithBridge Docker-unavailable', () => {
  it('returns error with CARINA_DIRECT_SHELL hint when Docker is unavailable', async () => {
    vi.doMock('./sandbox.js', () => ({
      checkDocker: vi.fn().mockResolvedValue(false),
      runCodeInSandbox: vi.fn(),
    }));

    const { runCodeWithBridge } = await import('./execute-code.js');
    const result = await runCodeWithBridge({
      code: 'print("hi")',
      language: 'python',
      sessionId: 'test-session',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('CARINA_DIRECT_SHELL');
    expect(result.stderr).toContain('Docker');
  });
});

describe('runCodeWithBridge cleanup', () => {
  it('removes the bridge directory after execution completes', async () => {
    let capturedBridgeDir = '';

    vi.doMock('./sandbox.js', () => ({
      checkDocker: vi.fn().mockResolvedValue(true),
      runCodeInSandbox: vi.fn(async (_code: unknown, _lang: unknown, opts: { bridgeDir?: string }) => {
        capturedBridgeDir = opts.bridgeDir ?? '';
        return { stdout: 'ok', stderr: '', exitCode: 0 };
      }),
    }));

    const { runCodeWithBridge } = await import('./execute-code.js');
    await runCodeWithBridge({
      code: 'print("hi")',
      language: 'python',
      sessionId: 'test-session',
    });

    if (capturedBridgeDir) {
      await expect(fs.access(capturedBridgeDir)).rejects.toThrow();
    }
  });
});
