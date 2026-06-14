import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('approval store and policy', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `carina-approval-test-${Date.now()}-${Math.random()}`);
    fs.mkdirSync(tmpHome, { recursive: true });
    vi.resetModules();
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_APPROVAL_POLICY = 'on';
    process.env.CARINA_APPROVAL_SHELL_SCAN = 'on';
    delete process.env.CARINA_APPROVAL_AUTO_LOW;
    delete process.env.CARINA_APPROVAL_REMEMBER_MS;
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_APPROVAL_POLICY;
    delete process.env.CARINA_APPROVAL_SHELL_SCAN;
  });

  it('blocks dangerous shell commands locally', async () => {
    const { evaluateApprovalPolicy } = await import('./approval-policy.js');
    const result = evaluateApprovalPolicy(
      'shell-exec',
      { command: 'rm -rf /' },
      { sessionId: 's1', profile: 'default' },
      { name: 'shell-exec', dangerous: true, description: '', parameters: {} },
    );
    expect(result?.decision).toBe('block');
  });

  it('allows via profile-scoped grant until expiry', async () => {
    const { grantApproval, resetApprovalStoreCache } = await import('./approval-store.js');
    const { evaluateApprovalPolicy } = await import('./approval-policy.js');

    grantApproval({
      tool: 'shell-exec',
      scope: 'profile',
      scopeId: 'alpha',
      ttlMs: 60_000,
    });
    resetApprovalStoreCache();

    const allowed = evaluateApprovalPolicy(
      'shell-exec',
      { command: 'echo hi' },
      { sessionId: 's1', profile: 'alpha' },
      { name: 'shell-exec', dangerous: true, description: '', parameters: {} },
    );
    expect(allowed?.decision).toBe('allow');

    const otherProfile = evaluateApprovalPolicy(
      'shell-exec',
      { command: 'echo hi' },
      { sessionId: 's1', profile: 'beta' },
      { name: 'shell-exec', dangerous: true, description: '', parameters: {} },
    );
    expect(otherProfile?.decision).toBe('needs_confirm');
  });

  it('expires grants after ttl', async () => {
    vi.useFakeTimers();
    const { grantApproval, resetApprovalStoreCache } = await import('./approval-store.js');
    const { evaluateApprovalPolicy } = await import('./approval-policy.js');

    grantApproval({
      tool: 'code-exec',
      scope: 'session',
      scopeId: 'sess-1',
      ttlMs: 1000,
    });
    resetApprovalStoreCache();

    expect(
      evaluateApprovalPolicy(
        'code-exec',
        { code: '1+1' },
        { sessionId: 'sess-1', profile: 'default' },
        { name: 'code-exec', dangerous: true, description: '', parameters: {} },
      )?.decision,
    ).toBe('allow');

    vi.advanceTimersByTime(1500);
    resetApprovalStoreCache();

    expect(
      evaluateApprovalPolicy(
        'code-exec',
        { code: '1+1' },
        { sessionId: 'sess-1', profile: 'default' },
        { name: 'code-exec', dangerous: true, description: '', parameters: {} },
      )?.decision,
    ).toBe('needs_confirm');

    vi.useRealTimers();
  });

  it('respects block rules over grants', async () => {
    const { addApprovalRule, grantApproval, resetApprovalStoreCache } = await import('./approval-store.js');
    const { evaluateApprovalPolicy } = await import('./approval-policy.js');

    grantApproval({
      tool: 'file-write',
      scope: 'profile',
      scopeId: 'default',
      ttlMs: 60_000,
    });
    addApprovalRule({
      action: 'block',
      scope: 'profile',
      scopeId: 'default',
      tool: 'file-write',
    });
    resetApprovalStoreCache();

    const result = evaluateApprovalPolicy(
      'file-write',
      { path: '/tmp/x' },
      { sessionId: 's1', profile: 'default' },
      { name: 'file-write', dangerous: true, description: '', parameters: {} },
    );
    expect(result?.decision).toBe('block');
  });

  it('returns null when policy disabled (no hot-path overhead semantics)', async () => {
    process.env.CARINA_APPROVAL_POLICY = 'off';
    const { evaluateApprovalPolicy } = await import('./approval-policy.js');
    expect(
      evaluateApprovalPolicy(
        'shell-exec',
        { command: 'echo ok' },
        { sessionId: 's1', profile: 'default' },
      ),
    ).toBeNull();
  });
});

describe('tool-runner approval integration', () => {
  const integrationHome = path.join(os.tmpdir(), `carina-tr-${Date.now()}`);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.CARINA_APPROVAL_POLICY = 'on';
    process.env.CARINA_HOME = integrationHome;
    fs.mkdirSync(integrationHome, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(integrationHome, { recursive: true, force: true });
    delete process.env.CARINA_APPROVAL_POLICY;
    delete process.env.CARINA_HOME;
  });

  it('skips confirm when allow rule matches', async () => {
    const { addApprovalRule, resetApprovalStoreCache } = await import('./approval-store.js');
    addApprovalRule({
      action: 'allow',
      scope: 'global',
      tool: 'dangerous-tool',
    });
    resetApprovalStoreCache();

    const mockTool = {
      name: 'dangerous-tool',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn().mockResolvedValue('done'),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
      getSessionTool: () => undefined,
    }));
    const { executeToolCall: exec } = await import('../agents/tool-runner.js');
    const confirm = vi.fn();
    const result = await exec(
      { type: 'tool_call', toolName: 'dangerous-tool', toolCallId: '1', params: {} },
      confirm,
    );
    expect(result).toBe('done');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('blocks before confirm when policy blocks', async () => {
    const { addApprovalRule, resetApprovalStoreCache } = await import('./approval-store.js');
    addApprovalRule({
      action: 'block',
      scope: 'global',
      tool: 'blocked-tool',
    });
    resetApprovalStoreCache();

    const mockTool = {
      name: 'blocked-tool',
      description: '',
      parameters: {},
      dangerous: true,
      execute: vi.fn(),
    };
    vi.doMock('../tools/index.js', () => ({
      registry: { get: () => mockTool },
      getSessionTool: () => undefined,
    }));
    const { executeToolCall: exec } = await import('../agents/tool-runner.js');
    const result = await exec(
      { type: 'tool_call', toolName: 'blocked-tool', toolCallId: '1', params: {} },
      vi.fn().mockResolvedValue(true),
    );
    expect(result).toMatchObject({ code: 'APPROVAL_BLOCKED' });
    expect(mockTool.execute).not.toHaveBeenCalled();
  });
});
