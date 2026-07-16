import { describe, expect, it, beforeEach } from 'vitest';
import {
  assertJitGrant,
  getJitCredentialStore,
  isJitCredentialsEnabled,
  issueJitGrantAfterConfirm,
  JitCredentialError,
  _resetJitCredentialStore,
} from '../jit-credentials.js';

describe('jit credentials', () => {
  beforeEach(() => {
    _resetJitCredentialStore();
    process.env.JIT_CREDENTIALS_ENABLED = 'true';
  });

  it('requires grant for privileged tools', () => {
    expect(isJitCredentialsEnabled()).toBe(true);
    expect(() => assertJitGrant('sess', 'shell-exec', { command: 'ls' })).toThrow(JitCredentialError);
  });

  it('allows tool after grant issued', () => {
    issueJitGrantAfterConfirm('sess', 'shell-exec', { command: 'ls' });
    expect(() => assertJitGrant('sess', 'shell-exec', { command: 'ls' })).not.toThrow();
    getJitCredentialStore().consumeGrant('sess', 'shell-exec', { command: 'ls' });
    expect(() => assertJitGrant('sess', 'shell-exec', { command: 'ls' })).toThrow(JitCredentialError);
  });
});
