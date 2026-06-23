import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [{ id: 'ev-1' }] }) },
}));

vi.mock('../../lib/instance-control.js', () => ({
  publishControlMessage: vi.fn().mockResolvedValue(undefined),
}));

import {
  applyRemediation,
  listRecentRemediationLog,
  resetRemediationRules,
  rollbackRemediation,
} from '../auto-remediation.js';
import { resetShieldModesForTests, getShieldMode } from '../session-shield.js';
import { resetSurfaceRestrictionsForTests } from '../attack-surface.js';

describe('AutoRemediation', () => {
  afterEach(() => {
    resetRemediationRules();
    resetShieldModesForTests();
    resetSurfaceRestrictionsForTests();
  });

  it('quarantines on repeated injection', async () => {
    const result = await applyRemediation({
      case: 'repeated_injection',
      sessionId: 'rem-1',
      instanceId: 'inst-1',
      reason: '3 injection attempts',
    });
    expect(result.applied).toBe(true);
    expect(result.actions).toContain('quarantine_session');
    const shield = await getShieldMode('rem-1');
    expect(shield.mode).toBe('quarantine');
  });

  it('restricts egress on suspicious domain', async () => {
    const result = await applyRemediation({
      case: 'suspicious_egress',
      sessionId: 'rem-2',
      instanceId: 'inst-1',
      reason: 'unknown outbound domain',
    });
    expect(result.applied).toBe(true);
    expect(result.actions).toContain('restrict_external_http');
  });

  it('rolls back remediation', async () => {
    await applyRemediation({
      case: 'repeated_injection',
      sessionId: 'rem-3',
      instanceId: 'inst-1',
      reason: 'test',
    });
    const rollback = await rollbackRemediation({
      case: 'repeated_injection',
      sessionId: 'rem-3',
      instanceId: 'inst-1',
    });
    expect(rollback.ok).toBe(true);
    const shield = await getShieldMode('rem-3');
    expect(shield.mode).toBe('observe');
  });

  it('lists recent remediation log rows', async () => {
    const { pool } = await import('../../db.js');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        id: 'ev-rem-1',
        event_type: 'auto_remediation_repeated_injection',
        description: 'Auto-remediation applied for repeated_injection',
        session_id: 'sess-9',
        instance_id: 'inst-1',
        metadata: { case: 'repeated_injection', actions: ['quarantine_session'] },
        created_at: new Date('2026-06-22T12:00:00Z'),
      }],
    } as never);

    const items = await listRecentRemediationLog(10);
    expect(items).toHaveLength(1);
    expect(items[0]?.action).toBe('quarantine_session');
    expect(items[0]?.target).toBe('sess-9');
    expect(items[0]?.result).toBe('success');
  });
});
