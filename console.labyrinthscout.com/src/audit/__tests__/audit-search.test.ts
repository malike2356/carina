import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the pool before importing the module
const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { searchAuditLog } from '../audit-search.js';

beforeEach(() => {
  mockQuery.mockReset();
});

function fakeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: 'tenant-01',
    event_type: 'admin',
    action: 'config_changed',
    detail: JSON.stringify({ key: 'rate_limit', old_value: 100, new_value: 50 }),
    severity: 'info',
    session_id: null,
    ip_address: null,
    admin_email: null,
    timestamp: '2026-06-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('searchAuditLog', () => {
  it('returns paginated results with no filters', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '42' }] }) // count
      .mockResolvedValueOnce({ rows: [fakeRow(), fakeRow({ id: '2', event_type: 'auth' })] });

    const result = await searchAuditLog({});

    expect(result.total).toBe(42);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(50);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.event_type).toBe('admin');
    expect(result.events[1]!.event_type).toBe('auth');
  });

  it('filters by tenant_id', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '3' }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });

    await searchAuditLog({ tenant_id: 'tenant-07' });

    const countCall = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(countCall[0]).toContain('tenant_id = $1');
    expect(countCall[1][0]).toBe('tenant-07');
  });

  it('filters by event_type', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ event_type: 'security' })] });

    await searchAuditLog({ event_type: 'security' });

    const countCall = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(countCall[0]).toContain('event_type = $1');
    expect(countCall[1][0]).toBe('security');
  });

  it('filters by severity', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ severity: 'critical' })] });

    await searchAuditLog({ severity: 'critical' });

    const countCall = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(countCall[0]).toContain('severity = $1');
    expect(countCall[1][0]).toBe('critical');
  });

  it('filters by date range (from/to)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });

    await searchAuditLog({
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-07T23:59:59.000Z',
    });

    const countCall = mockQuery.mock.calls[0];
    const sql = countCall[0] as string;
    expect(sql).toContain('timestamp >=');
    expect(sql).toContain('timestamp <=');
  });

  it('filters by free-text query against action and detail', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });

    await searchAuditLog({ query: 'rate_limit' });

    const countCall = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(countCall[0]).toContain('ILIKE');
    expect(countCall[1].some((v) => String(v).includes('rate_limit'))).toBe(true);
  });

  it('handles pagination — page 2', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '100' }] })
      .mockResolvedValueOnce({ rows: [fakeRow()] });

    const result = await searchAuditLog({ page: 2, per_page: 20 });

    expect(result.page).toBe(2);
    expect(result.per_page).toBe(20);
    expect(result.total).toBe(100);

    // Check offset is correct
    const dataCall = mockQuery.mock.calls[1] as [string, unknown[]];
    expect(dataCall[0]).toContain('LIMIT');
    expect(dataCall[0]).toContain('OFFSET');
  });

  it('capped per_page at 500', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1000' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await searchAuditLog({ per_page: 1000 });

    expect(result.per_page).toBe(500);
  });

  it('serializes detail JSONB correctly', async () => {
    const detailObj = { foo: 'bar', nested: { baz: 42 } };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ detail: detailObj })] });

    const result = await searchAuditLog({});
    expect(result.events[0]!.detail).toEqual(detailObj);
  });

  it('handles string-encoded detail column', async () => {
    const detailStr = '{"a":1,"b":"c"}';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [fakeRow({ detail: detailStr })] });

    const result = await searchAuditLog({});
    expect(result.events[0]!.detail).toEqual({ a: 1, b: 'c' });
  });
});
