import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateScoutScore, getComplianceScore } from '../scoring.js';
import type { ComplianceScore } from '../types.js';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../table-check.js', () => ({
  hasComplianceEvidenceTable: vi.fn(),
}));

import { pool } from '../../db.js';
import { hasComplianceEvidenceTable } from '../table-check.js';

describe('calculateScoutScore', () => {
  it('weights security 60% and compliance 40%', () => {
    const compliance: ComplianceScore = {
      configured: true,
      totalControls: 31,
      coveredControls: 20,
      coveragePercent: 65,
      evidenceCount: 10,
      evidenceWindow: { start: '', end: '' },
      lastCollectionAt: null,
      controls: [],
      trendData: [],
    };
    expect(calculateScoutScore(80, compliance)).toEqual({
      total: 74,
      security: 80,
      compliance: 65,
    });
  });

  it('uses zero compliance when not configured', () => {
    const compliance: ComplianceScore = {
      configured: false,
      totalControls: 31,
      coveredControls: 0,
      coveragePercent: 0,
      evidenceCount: 0,
      evidenceWindow: { start: '', end: '' },
      lastCollectionAt: null,
      controls: [],
      trendData: [],
    };
    expect(calculateScoutScore(90, compliance).total).toBe(54);
  });
});

describe('getComplianceScore', () => {
  beforeEach(() => {
    vi.mocked(hasComplianceEvidenceTable).mockReset();
    vi.mocked(pool.query).mockReset();
  });

  it('returns configured false when evidence table is missing', async () => {
    vi.mocked(hasComplianceEvidenceTable).mockResolvedValue(false);
    const score = await getComplianceScore();
    expect(score.configured).toBe(false);
    expect(score.totalControls).toBe(31);
    expect(score.controls).toEqual([]);
  });

  it('returns coverage from database rows', async () => {
    vi.mocked(hasComplianceEvidenceTable).mockResolvedValue(true);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [
          {
            control_id: 'CC6.1',
            name: 'Access Control',
            criteria_group: 'CC6',
            evidence_count: '2',
            last_evidence_at: '2026-06-01T00:00:00.000Z',
          },
          {
            control_id: 'CC7.1',
            name: 'System Monitoring',
            criteria_group: 'CC7',
            evidence_count: '0',
            last_evidence_at: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [{ last_at: '2026-06-01T00:00:00.000Z' }] } as never);

    for (let i = 0; i < 12; i++) {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
    }

    const score = await getComplianceScore();
    expect(score.configured).toBe(true);
    expect(score.coveredControls).toBe(1);
    expect(score.evidenceCount).toBe(5);
    expect(score.controls[0]?.gapAction).toBeUndefined();
    expect(score.controls[1]?.gapAction?.actionType).toBe('configure_monitoring');
  });
});
