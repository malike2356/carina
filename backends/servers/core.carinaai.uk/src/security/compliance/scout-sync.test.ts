import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildScoutEvidencePayload, scoutControlsForCarinaId } from './scout-sync.js';
import type { ComplianceReport } from './types.js';

describe('scout-sync', () => {
  it('maps Carina SOC2 controls to Scout TSC IDs', () => {
    expect(scoutControlsForCarinaId('soc2-cc6.1')).toEqual(['CC6.1', 'CC6.2', 'CC6.3']);
    expect(scoutControlsForCarinaId('soc2-cc7.2')).toContain('CC7.1');
    expect(scoutControlsForCarinaId('unknown')).toEqual([]);
  });

  it('builds Scout payload from compliance report evidence', () => {
    const report: ComplianceReport = {
      framework: { id: 'soc2', name: 'SOC 2', description: 'test' },
      generatedAt: '2026-06-22T00:00:00.000Z',
      overallStatus: 'compliant',
      scorePercent: 80,
      gapAnalysis: [],
      evidence: [
        {
          framework: 'soc2',
          controlId: 'soc2-cc6.1',
          controlName: 'Logical access controls',
          status: 'compliant',
          evidence: [{
            type: 'config',
            description: 'RBAC configuration',
            source: 'security/tool-rbac.ts',
            value: { ok: true },
            collectedAt: 1_700_000_000_000,
            expiresAt: 1_800_000_000_000,
          }],
          lastCollected: 1_700_000_000_000,
          nextCollection: 1_800_000_000_000,
        },
        {
          framework: 'soc2',
          controlId: 'soc2-cc9.9',
          controlName: 'Unmapped',
          status: 'non_compliant',
          evidence: [],
          lastCollected: 1_700_000_000_000,
          nextCollection: 1_800_000_000_000,
        },
      ],
    };

    const payload = buildScoutEvidencePayload(report);
    expect(payload.framework).toBe('soc2');
    expect(payload.controls).toHaveLength(1);
    expect(payload.controls[0]?.carinaControlId).toBe('soc2-cc6.1');
    expect(payload.controls[0]?.evidence[0]?.type).toBe('config');
  });
});

describe('syncComplianceReportToScout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SCOUT_CONSOLE_URL = 'http://scout-console:4444';
    process.env.SCOUT_API_KEY = 'test-key';
  });

  it('posts mapped evidence to Scout console', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        ok: true,
        inserted: 3,
        skipped: 0,
        controlsTouched: ['CC6.1'],
        errors: [],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { syncComplianceReportToScout } = await import('./scout-sync.js');
    const result = await syncComplianceReportToScout({
      framework: { id: 'soc2', name: 'SOC 2', description: 'test' },
      generatedAt: '2026-06-22T00:00:00.000Z',
      overallStatus: 'compliant',
      scorePercent: 100,
      gapAnalysis: [],
      evidence: [{
        framework: 'soc2',
        controlId: 'soc2-cc6.1',
        controlName: 'Logical access controls',
        status: 'compliant',
        evidence: [{
          type: 'config',
          description: 'RBAC configuration',
          source: 'security/tool-rbac.ts',
          value: { ok: true },
          collectedAt: Date.now(),
          expiresAt: Date.now() + 1000,
        }],
        lastCollected: Date.now(),
        nextCollection: Date.now() + 1000,
      }],
    });

    expect(result.inserted).toBe(3);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init?.headers && (init.headers as Record<string, string>)['X-Scout-Key'])).toBe('test-key');
  });
});
