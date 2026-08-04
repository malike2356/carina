import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluatePathSafety,
  evaluateUrlSafety,
} from './path-safety.js';
import { redactSensitiveText, redactToolParams } from './redaction.js';
import {
  _resetAuthRateLimitsForTests,
  checkAuthRateLimit,
  clearAuthFailures,
  recordAuthFailure,
} from './auth-rate-limit.js';
import {
  evaluateAdminToolPolicy,
  isAdminRole,
} from './admin-tool-policy.js';
import { collectSecurityDoctorChecks } from './security-doctor.js';
import { scanAgentOutput, scanToolOutput } from './prompt-guard-middleware.js';

describe('path-safety', () => {
  it('blocks path traversal', () => {
    const result = evaluatePathSafety('/etc/../etc/passwd', 'read');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('PATH_TRAVERSAL');
    }
  });

  it('allows safe workspace-relative paths', () => {
    const prev = process.env.CARINA_AGENT_WORKSPACE;
    const ws = '/tmp/carina-test-workspace';
    process.env.CARINA_AGENT_WORKSPACE = ws;
    const result = evaluatePathSafety('notes.txt', 'read');
    if (prev === undefined) delete process.env.CARINA_AGENT_WORKSPACE;
    else process.env.CARINA_AGENT_WORKSPACE = prev;
    expect(result.allowed).toBe(true);
  });
});

describe('url-safety', () => {
  it('blocks private network hosts', () => {
    const result = evaluateUrlSafety('https://192.168.1.10/internal', {
      useEgressFilter: false,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('PRIVATE_HOST');
    }
  });

  it('allows public https URLs when egress filter is off', () => {
    const result = evaluateUrlSafety('https://example.com/page', {
      useEgressFilter: false,
    });
    expect(result.allowed).toBe(true);
  });
});

describe('redaction', () => {
  it('redacts api keys in text', () => {
    const out = redactSensitiveText('token sk-abcdefghijklmnopqrstuvwxyz1234567890abcd');
    expect(out).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890abcd');
    expect(out).toContain('[REDACTED]');
  });

  it('redacts sensitive tool params', () => {
    const out = redactToolParams({ apiKey: 'secret-value', query: 'hello' });
    expect(out).toEqual({ apiKey: '[REDACTED]', query: 'hello' });
  });

  it('redacts tool output via scanToolOutput', async () => {
    const out = await scanToolOutput('http-tool', 'Bearer ghp_abcdefghijklmnopqrstuvwxyz1234');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz1234');
  });

  it('redacts agent output via scanAgentOutput', async () => {
    const out = await scanAgentOutput('use carina_live_secret_token_here');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('carina_live_secret_token_here');
  });
});

describe('auth-rate-limit', () => {
  afterEach(() => {
    _resetAuthRateLimitsForTests();
    delete process.env.CARINA_AUTH_RATE_LIMIT_MAX;
  });

  it('allows attempts under the failure threshold', async () => {
    expect((await checkAuthRateLimit('test', 'user@example.com')).allowed).toBe(true);
    await recordAuthFailure('test', 'user@example.com');
    expect((await checkAuthRateLimit('test', 'user@example.com')).allowed).toBe(true);
  });

  it('blocks after repeated failures', async () => {
    process.env.CARINA_AUTH_RATE_LIMIT_MAX = '2';
    await recordAuthFailure('test', 'user@example.com');
    const blocked = await recordAuthFailure('test', 'user@example.com');
    expect(blocked.allowed).toBe(false);
    const check = await checkAuthRateLimit('test', 'user@example.com');
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('clears failures after successful auth', async () => {
    process.env.CARINA_AUTH_RATE_LIMIT_MAX = '2';
    await recordAuthFailure('test', 'user@example.com');
    await clearAuthFailures('test', 'user@example.com');
    expect((await checkAuthRateLimit('test', 'user@example.com')).allowed).toBe(true);
  });
});

describe('admin-tool-policy', () => {
  it('blocks shell-exec for viewer role', () => {
    const decision = evaluateAdminToolPolicy('shell-exec', 'viewer', { dangerous: true });
    expect(decision.allowed).toBe(false);
  });

  it('allows shell-exec for admin role', () => {
    const decision = evaluateAdminToolPolicy('shell-exec', 'admin', { dangerous: true });
    expect(decision.allowed).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('operator')).toBe(false);
  });
});

describe('security-doctor', () => {
  it('returns structured checks including approval policy', () => {
    const checks = collectSecurityDoctorChecks();
    expect(checks.some((c) => c.id === 'approval-policy')).toBe(true);
    expect(checks.some((c) => c.id === 'auth-rate-limit')).toBe(true);
  });
});
