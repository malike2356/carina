import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { runRetention } from '../audit-retention.js';
import { RETENTION_POLICIES } from '../compliance/retention-policy.js';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('runRetention', () => {
  it('applies each retention policy', async () => {
    // Each policy query returns 0 deleted (no old rows)
    mockQuery.mockResolvedValue({ rows: [{ deleted: '0' }] });

    await runRetention();

    // Should call pool.query once per policy
    expect(mockQuery).toHaveBeenCalledTimes(RETENTION_POLICIES.length);

    for (let i = 0; i < RETENTION_POLICIES.length; i++) {
      const [sql, params] = mockQuery.mock.calls[i] as [string, unknown[]];
      const policy = RETENTION_POLICIES[i]!;
      expect(sql).toContain('DELETE FROM audit_log');
      expect(sql).toContain('event_type = $1');
      expect(params[0]).toBe(policy.event_type);
      expect(params[1]).toBe(String(policy.retention_days));
    }
  });

  it('deletes rows older than retention window', async () => {
    // Simulate: admin (730d) has 5 old rows, tool_execution (90d) has 10
    const deletedCounts = [10, 0, 0, 5, 0]; // tool_execution=10, admin=5
    let callIdx = 0;
    mockQuery.mockImplementation(() => {
      const count = deletedCounts[callIdx] ?? 0;
      callIdx++;
      return Promise.resolve({ rows: [{ deleted: String(count) }] });
    });

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await runRetention();

    // Should log the deletions
    expect(consoleInfoSpy).toHaveBeenCalled();
    const logMessage = consoleInfoSpy.mock.calls[0]?.[0] as string | undefined;
    expect(logMessage).toContain('tool_execution=10');
    expect(logMessage).toContain('admin=5');

    consoleInfoSpy.mockRestore();
  });

  it('tolerates failures in individual policy queries', async () => {
    // First policy works, second fails, third works
    let callIdx = 0;
    mockQuery.mockImplementation(() => {
      callIdx++;
      if (callIdx === 2) {
        return Promise.reject(new Error('Connection lost'));
      }
      return Promise.resolve({ rows: [{ deleted: '3' }] });
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runRetention();

    // Should have logged the failure for the second policy
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errMsg = consoleErrorSpy.mock.calls[0]?.[0] as string | undefined;
    expect(errMsg).toContain('Failed to apply retention');
    expect(errMsg).toContain('Connection lost');

    consoleErrorSpy.mockRestore();
  });

  it('applies correct retention windows from RETENTION_POLICIES', () => {
    // Verify the constants match the spec
    const expected: Record<string, number> = {
      tool_execution: 90,
      model_request: 90,
      security: 365,
      admin: 730,
      auth: 365,
    };

    for (const policy of RETENTION_POLICIES) {
      expect(policy.retention_days).toBe(expected[policy.event_type]);
    }
  });
});
