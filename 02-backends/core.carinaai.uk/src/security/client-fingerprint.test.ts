import { describe, expect, it } from 'vitest';
import { summarizeUserAgent, buildClientFingerprint } from './client-fingerprint.js';
import type { Request } from 'express';

describe('client-fingerprint', () => {
  it('summarizes common user agents', () => {
    expect(summarizeUserAgent('curl/8.0')).toBe('curl');
    expect(summarizeUserAgent('python-requests/2.0')).toBe('Python client');
    expect(summarizeUserAgent('Mozilla/5.0 Chrome/120')).toBe('Browser');
  });

  it('builds stable hashed fingerprints without raw IP', () => {
    const req = {
      headers: {
        'user-agent': 'curl/8.0',
        'x-forwarded-for': '203.0.113.10',
        'x-carina-client-id': 'agent-a',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    const a = buildClientFingerprint(req, { tenantId: 't1', tokenId: 'k1' });
    const b = buildClientFingerprint(req, { tenantId: 't1', tokenId: 'k1' });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).not.toContain('203.0.113');
    expect(a.uaSummary).toBe('curl');
    expect(a.clientHint).toBe('agent-a');
  });
});
