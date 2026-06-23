import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateNodeShellCommand, nodeShellPolicyEnabled } from './node-command-policy.js';

describe('node-command-policy', () => {
  beforeEach(() => {
    vi.stubEnv('CARINA_NODE_SHELL_POLICY', 'true');
    vi.stubEnv('CARINA_HOME', '/tmp/carina-node-policy-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks dangerous rm -rf / patterns', () => {
    const result = evaluateNodeShellCommand('rm -rf /');
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/blocked/);
  });

  it('allows benign commands', () => {
    expect(evaluateNodeShellCommand('echo hello').allowed).toBe(true);
  });

  it('can be disabled via env', () => {
    vi.stubEnv('CARINA_NODE_SHELL_POLICY', 'off');
    expect(nodeShellPolicyEnabled()).toBe(false);
    expect(evaluateNodeShellCommand('rm -rf /').allowed).toBe(true);
  });
});
