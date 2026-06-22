import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestCarinaEvidence } from '../evidence-ingest.js';
import { scoutControlsForCarinaId } from '../control-map.js';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../table-check.js', () => ({
  hasComplianceEvidenceTable: vi.fn(),
}));

import { pool } from '../../db.js';
import { hasComplianceEvidenceTable } from '../table-check.js';

describe('control-map', () => {
  it('maps Carina SOC2 controls to Scout IDs', () => {
    expect(scoutControlsForCarinaId('soc2-cc7.2')).toContain('CC7.1');
  });
});

describe('ingestCarinaEvidence', () => {
  beforeEach(() => {
    vi.mocked(hasComplianceEvidenceTable).mockReset();
    vi.mocked(pool.query).mockReset();
  });

  it('inserts evidence for mapped Scout controls', async () => {
    vi.mocked(hasComplianceEvidenceTable).mockResolvedValue(true);
    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('compliance_controls')) {
        return { rows: [{ exists: true }] };
      }
      if (sql.includes('content_hash')) {
        return { rows: [{ exists: false }] };
      }
      return { rows: [] };
    });

    const result = await ingestCarinaEvidence({
      framework: 'soc2',
      generatedAt: '2026-06-22T00:00:00.000Z',
      controls: [{
        carinaControlId: 'soc2-cc6.1',
        controlName: 'Logical access controls',
        status: 'compliant',
        collectorId: 'rbac_config',
        evidence: [{
          type: 'config',
          description: 'RBAC configuration',
          source: 'security/tool-rbac.ts',
          value: { ok: true },
          collectedAt: Date.now(),
        }],
      }],
    });

    expect(result.inserted).toBeGreaterThan(0);
    expect(result.controlsTouched).toContain('CC6.1');
  });

  it('skips duplicate content hashes', async () => {
    vi.mocked(hasComplianceEvidenceTable).mockResolvedValue(true);
    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('compliance_controls')) {
        return { rows: [{ exists: true }] };
      }
      if (sql.includes('content_hash')) {
        return { rows: [{ exists: true }] };
      }
      return { rows: [] };
    });

    const result = await ingestCarinaEvidence({
      framework: 'soc2',
      generatedAt: '2026-06-22T00:00:00.000Z',
      controls: [{
        carinaControlId: 'soc2-cc6.1',
        controlName: 'Logical access controls',
        status: 'compliant',
        evidence: [{
          type: 'config',
          description: 'RBAC configuration',
          source: 'security/tool-rbac.ts',
          value: { ok: true },
          collectedAt: Date.now(),
        }],
      }],
    });

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });
});
