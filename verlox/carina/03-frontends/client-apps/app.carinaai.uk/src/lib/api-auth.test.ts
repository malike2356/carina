import { describe, expect, it } from 'vitest';
import { LegalGateRequiredError } from '@/lib/legal/errors';
import { respondAuthError } from '@/lib/api-auth';

describe('respondAuthError', () => {
  it('returns 403 with legal_acceptance_required for LegalGateRequiredError', () => {
    const gate = {
      code: 'legal_acceptance_required' as const,
      pending: [
        {
          type: 'terms_of_service' as const,
          version: '1.0',
          url: '/legal/terms',
          effectiveDate: '2026-06-30',
        },
      ],
    };
    const res = respondAuthError(new LegalGateRequiredError(gate));
    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthorized errors', () => {
    const res = respondAuthError(new Error('Unauthorized'));
    expect(res.status).toBe(401);
  });
});
