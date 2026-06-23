import { describe, expect, it, vi, beforeEach } from 'vitest';

const auditRows: Array<Record<string, unknown>> = [];

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (/INSERT INTO product_audit_log/.test(sql)) {
        auditRows.push({
          id: `audit-${auditRows.length + 1}`,
          org_id: params?.[0],
          actor_user_id: params?.[1],
          action: params?.[2],
          details: JSON.parse(String(params?.[5])),
          created_at: new Date(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (/FROM product_audit_log/.test(sql)) {
        const orgId = params?.[0];
        let rows = auditRows.filter((r) => r.org_id === orgId);
        const sinceIdx = sql.indexOf('created_at >=');
        if (sinceIdx >= 0 && params?.[1] instanceof Date) {
          const since = params[1] as Date;
          rows = rows.filter((r) => (r.created_at as Date) >= since);
        }
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

import { listProductAudit, listProductAuditForPlan, writeProductAudit } from './product-audit.js';

describe('product-audit', () => {
  beforeEach(() => {
    auditRows.length = 0;
  });

  it('writeProductAudit redacts apiKey from details', async () => {
    await writeProductAudit({
      orgId: 'org-1',
      action: 'vault.key_saved',
      details: { provider: 'openai', apiKey: 'sk-secret', note: 'ok' },
    });
    expect(auditRows[0].details).toEqual({ provider: 'openai', apiKey: '[REDACTED]', note: 'ok' });
  });

  it('writeProductAudit defaults empty details to {}', async () => {
    await writeProductAudit({ orgId: 'org-1', action: 'org.member_invited' });
    expect(auditRows[0].details).toEqual({});
  });

  it('listProductAudit returns only matching org rows', async () => {
    await writeProductAudit({ orgId: 'org-a', action: 'a.event' });
    await writeProductAudit({ orgId: 'org-b', action: 'b.event' });
    const rows = await listProductAudit('org-a');
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('a.event');
  });

  it('listProductAuditForPlan excludes events outside retention', async () => {
    auditRows.push({
      id: 'old-1',
      org_id: 'org-1',
      actor_user_id: null,
      action: 'old.event',
      details: {},
      created_at: new Date('2020-01-01T00:00:00Z'),
    });
    await writeProductAudit({ orgId: 'org-1', action: 'recent.event' });

    const result = await listProductAuditForPlan('org-1', 'carina_ops_starter', { limit: 50 });
    expect(result.events.some((event) => event.action === 'recent.event')).toBe(true);
    expect(result.events.some((event) => event.action === 'old.event')).toBe(false);
  });

  it('exportProductAuditCsv redacts api keys from details_json column', async () => {
    await writeProductAudit({
      orgId: 'org-1',
      action: 'vault.key_saved',
      details: { provider: 'openai', apiKey: 'sk-secret' },
    });
    const { exportProductAuditCsv } = await import('./product-audit.js');
    const csv = await exportProductAuditCsv('org-1', 'carina_ops_team');
    expect(csv.startsWith('id,action,actor_email')).toBe(true);
    expect(csv).not.toContain('sk-secret');
    expect(csv).toContain('vault.key_saved');
  });
});
