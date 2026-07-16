import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const appendSecurityAudit = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('./security-audit.js', () => ({
  appendSecurityAudit: (...args: unknown[]) => appendSecurityAudit(...args),
}));

async function loadStore() {
  vi.resetModules();
  return import('./client-approval-store.js');
}

function schemaMocks() {
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] });
}

describe('client-approval-store', () => {
  beforeEach(() => {
    query.mockReset();
    appendSecurityAudit.mockReset();
    process.env.AIVA_CLIENT_APPROVAL = 'true';
  });

  it('puts unknown clients into pending approval', async () => {
    schemaMocks();
    // isTokenSuspended
    query.mockResolvedValueOnce({ rows: [] });
    // existing lookup
    query.mockResolvedValueOnce({ rows: [] });
    // insert pending
    query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        tenant_id: 'partner-1',
        token_id: 'key-1',
        fingerprint: 'fp1',
        status: 'pending',
        requested_scopes: ['session'],
        ip_hash: 'ip1',
        ua_hash: 'ua1',
        ua_summary: 'curl',
        client_hint: null,
        last_seen_at: new Date(),
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });

    const { ensureClientAccess } = await loadStore();
    const result = await ensureClientAccess({
      tenantId: 'partner-1',
      tokenId: 'key-1',
      fingerprint: {
        fingerprint: 'fp1',
        ipHash: 'ip1',
        uaHash: 'ua1',
        uaSummary: 'curl',
        clientHint: null,
      },
      requestedScopes: ['session'],
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('pending');
    expect(result.code).toBe('CLIENT_PENDING_APPROVAL');
  });

  it('allows approved clients until expiry', async () => {
    schemaMocks();
    query.mockResolvedValueOnce({ rows: [] }); // suspension
    query.mockResolvedValueOnce({
      rows: [{
        id: 2,
        tenant_id: 'partner-1',
        token_id: 'key-1',
        fingerprint: 'fp1',
        status: 'approved',
        requested_scopes: ['session'],
        ip_hash: 'ip1',
        ua_hash: 'ua1',
        ua_summary: 'curl',
        client_hint: null,
        last_seen_at: new Date(),
        expires_at: new Date(Date.now() + 86_400_000),
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });
    query.mockResolvedValueOnce({ rows: [] }); // last_seen update

    const { ensureClientAccess } = await loadStore();
    const result = await ensureClientAccess({
      tenantId: 'partner-1',
      tokenId: 'key-1',
      fingerprint: {
        fingerprint: 'fp1',
        ipHash: 'ip1',
        uaHash: 'ua1',
        uaSummary: 'curl',
        clientHint: null,
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('approved');
  });

  it('keeps denied clients blocked', async () => {
    schemaMocks();
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [{
        id: 3,
        tenant_id: 'partner-1',
        token_id: 'key-1',
        fingerprint: 'fp1',
        status: 'denied',
        requested_scopes: [],
        ip_hash: null,
        ua_hash: null,
        ua_summary: null,
        client_hint: null,
        last_seen_at: new Date(),
        expires_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const { ensureClientAccess } = await loadStore();
    const result = await ensureClientAccess({
      tenantId: 'partner-1',
      tokenId: 'key-1',
      fingerprint: {
        fingerprint: 'fp1',
        ipHash: 'ip1',
        uaHash: 'ua1',
        uaSummary: 'curl',
        clientHint: null,
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('denied');
    expect(result.code).toBe('CLIENT_APPROVAL_DENIED');
  });
});
