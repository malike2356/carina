import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { handleDataAccessRequest } from '../compliance/data-access-request.js';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('handleDataAccessRequest (SAR)', () => {
  it('records the SAR request and returns full data export', async () => {
    // 1st call: INSERT compliance_request -> returns request row
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'req-001',
          requested_at: '2026-06-08T10:00:00.000Z',
          due_by: '2026-07-08T10:00:00.000Z',
        },
      ],
    });

    // Subsequent calls: audit_log, security_events, accounts,
    // carina_instances, blocked_sessions, throttle_state
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await handleDataAccessRequest({
      tenant_id: 'tenant-07',
      email: 'user@example.com',
    });

    expect(result.request_id).toBe('req-001');
    expect(result.tenant_id).toBe('tenant-07');
    expect(result.email).toBe('user@example.com');
    expect(result.due_by).toBe('2026-07-08T10:00:00.000Z');

    // Verify the data structure includes all tables
    expect(result.data).toHaveProperty('audit_events');
    expect(result.data).toHaveProperty('security_events');
    expect(result.data).toHaveProperty('accounts');
    expect(result.data).toHaveProperty('carina_instances');
    expect(result.data).toHaveProperty('blocked_sessions');
    expect(result.data).toHaveProperty('throttle_state');

    // Should have made 7 queries: 1 insert + 6 selects
    expect(mockQuery).toHaveBeenCalledTimes(7);
  });

  it('queries all tables containing tenant data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'req-002',
          requested_at: '2026-06-08T11:00:00.000Z',
          due_by: '2026-07-08T11:00:00.000Z',
        },
      ],
    });

    // Simulate data in each table
    let callCount = 1;
    mockQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // audit_log
        return Promise.resolve({
          rows: [
            {
              id: 'a1',
              tenant_id: 'tenant-07',
              event_type: 'admin',
              action: 'test',
              detail: {},
              severity: 'info',
              session_id: null,
              ip_address: null,
              admin_email: null,
              timestamp: '2026-06-08T10:00:00.000Z',
            },
          ],
        });
      }
      if (callCount === 4) {
        // accounts
        return Promise.resolve({
          rows: [{ id: 'acct-1', email: 'user@example.com', created_at: '2026-01-01T00:00:00.000Z' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await handleDataAccessRequest({
      tenant_id: 'tenant-07',
      email: 'user@example.com',
    });

    expect(result.data.audit_events).toHaveLength(1);
    expect(result.data.audit_events[0]!.id).toBe('a1');
    expect(result.data.accounts).toHaveLength(1);
    expect(result.data.accounts[0]!.email).toBe('user@example.com');
  });

  it('continues if a partial query fails', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'req-003',
          requested_at: '2026-06-08T12:00:00.000Z',
          due_by: '2026-07-08T12:00:00.000Z',
        },
      ],
    });

    // First data query (audit_log) fails
    let callCount = 1;
    mockQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error('Audit log unavailable'));
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await handleDataAccessRequest({
      tenant_id: 'tenant-07',
      email: 'user@example.com',
    });

    // Should still complete; audit_events is empty due to failure
    expect(result.data.audit_events).toEqual([]);
    expect(result.request_id).toBe('req-003');
  });

  it('throws if the compliance request insert fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    await expect(
      handleDataAccessRequest({
        tenant_id: 'tenant-07',
        email: 'user@example.com',
      }),
    ).rejects.toThrow('DB error');
  });
});
