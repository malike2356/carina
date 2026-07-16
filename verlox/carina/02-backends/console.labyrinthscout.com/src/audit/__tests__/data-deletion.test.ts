import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { handleDataDeletion } from '../compliance/data-deletion.js';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('handleDataDeletion (Right to Erasure)', () => {
  it('anonymizes PII and retains audit trail', async () => {
    // 1st: check if already erased -> no existing row
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // 2nd: INSERT compliance_request
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'era-req-001' }],
    });

    // 3rd: UPDATE accounts
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });

    // 4th: UPDATE audit_log PII
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });

    // 5th: UPDATE security_events
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });

    // 6th: UPDATE carina_instances
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

    // 7th: UPDATE compliance_requests -> mark completed
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await handleDataDeletion({
      tenant_id: 'tenant-07',
      email: 'user@example.com',
    });

    expect(result.status).toBe('completed');
    expect(result.anonymized.accounts).toBe(1);
    expect(result.anonymized.audit_log_entries).toBe(3);
    expect(result.anonymized.security_events).toBe(5);
    expect(result.anonymized.carina_instances).toBe(2);

    // Verify accounts were anonymized
    const accountsCall = mockQuery.mock.calls[2];
    const accountsSql = accountsCall[0] as string;
    expect(accountsSql).toContain('UPDATE accounts');
    expect(accountsSql).toContain('[ERASED]');
  });

  it('audit_log entries are anonymized not deleted', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'era-req-002' }] });
    // No email -> accounts step skipped
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '4' }] }); // audit_log
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // security_events
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // carina_instances
    mockQuery.mockResolvedValueOnce({ rows: [] }); // mark completed

    const result = await handleDataDeletion({
      tenant_id: 'tenant-07',
    });

    // audit_log is call index 2 (0: check, 1: insert, 2: audit_log)
    const auditCall = mockQuery.mock.calls[2];
    const auditSql = auditCall[0] as string;
    // Must be UPDATE (anonymize), not DELETE
    expect(auditSql).toContain('UPDATE audit_log');
    expect(auditSql).toContain('[ERASED]');
    expect(auditSql).not.toContain('DELETE');
    expect(result.anonymized.audit_log_entries).toBe(4);
  });

  it('is idempotent; returns already_erased on second run', async () => {
    // First call detects an existing completed erasure request
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'era-req-existing' }],
    });

    const result = await handleDataDeletion({
      tenant_id: 'tenant-07',
      email: 'user@example.com',
    });

    expect(result.status).toBe('already_erased');
    expect(mockQuery).toHaveBeenCalledTimes(1); // Only the check query
  });

  it('handles missing email gracefully', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'era-req-003' }] });

    // accounts query: email is empty string so no rows match
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await handleDataDeletion({
      tenant_id: 'tenant-unknown',
    });

    expect(result.status).toBe('completed');
    // No accounts to anonymize without email
    expect(result.anonymized.accounts).toBe(0);
  });

  it('throws on compliance request insert failure', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Simulate insert returning no row (triggering the custom error)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      handleDataDeletion({
        tenant_id: 'tenant-07',
      }),
    ).rejects.toThrow('Failed to record erasure compliance request');
  });

  it('does not break foreign key integrity', async () => {
    // All UPDATE statements use SET not DELETE
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'era-req-004' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await handleDataDeletion({ tenant_id: 'tenant-07', email: 'test@test.com' });

    // All 6 data-modifying calls should be UPDATE, never DELETE
    for (let i = 2; i <= 6; i++) {
      const call = mockQuery.mock.calls[i] as [string, unknown[]];
      const sql = call[0];
      expect(sql).toContain('UPDATE');
      expect(sql).not.toContain('DELETE');
    }
  });
});
