import { describe, expect, it } from 'vitest';
import { hashClientIp, resolveRequestIp } from './ip-hash';
import { isLegalExemptApiPath } from './legal-gate';
import { toLegalGatePayload } from './acceptance';
import type { LegalDocumentSummary } from './documents';

describe('legal ip-hash', () => {
  it('hashes IP with salt as sha256 hex', () => {
    const hash = hashClientIp('203.0.113.10', 'test-salt');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe('203.0.113.10');
    expect(hashClientIp('203.0.113.10', 'test-salt')).toBe(hash);
  });

  it('returns null for empty IP', () => {
    expect(hashClientIp('', 'salt')).toBeNull();
    expect(hashClientIp(null, 'salt')).toBeNull();
  });

  it('resolves forwarded-for first IP', () => {
    expect(resolveRequestIp('203.0.113.1, 198.51.100.2', null)).toBe('203.0.113.1');
    expect(resolveRequestIp(null, '10.0.0.1')).toBe('10.0.0.1');
  });
});

describe('legal-gate paths', () => {
  it('exempts legal and auth API routes', () => {
    expect(isLegalExemptApiPath('/api/legal/current')).toBe(true);
    expect(isLegalExemptApiPath('/api/legal/status')).toBe(true);
    expect(isLegalExemptApiPath('/api/legal/accept')).toBe(true);
    expect(isLegalExemptApiPath('/api/auth/logout')).toBe(true);
    expect(isLegalExemptApiPath('/api/chat')).toBe(false);
  });
});

describe('legal gate payload', () => {
  const doc: LegalDocumentSummary = {
    type: 'terms_of_service',
    version: '1.0',
    url: '/legal/terms',
    effectiveDate: '2026-06-30',
  };

  it('returns null when all current documents accepted', () => {
    expect(
      toLegalGatePayload({
        pending: [],
        accepted: [{ ...doc, accepted_at: '2026-06-30T10:00:00Z' }],
        all_current_accepted: true,
      }),
    ).toBeNull();
  });

  it('returns legal_acceptance_required when pending docs exist', () => {
    const payload = toLegalGatePayload({
      pending: [doc],
      accepted: [],
      all_current_accepted: false,
    });
    expect(payload?.code).toBe('legal_acceptance_required');
    expect(payload?.pending).toHaveLength(1);
  });
});
