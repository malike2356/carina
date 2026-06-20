import { describe, it, expect } from 'vitest';
import { suggestToolsForFinding, formatInvestigationBrief } from './scout-tool-suggestions.js';
import type { ScoutFinding } from '../scout-findings-types.js';

const baseFinding: ScoutFinding = {
  id: 'f1',
  scanRunId: null,
  targetId: 't1',
  accountId: 'a1',
  tool: 'nuclei',
  findingType: 'cve',
  severity: 'critical',
  cvssScore: 9.8,
  title: 'CVE-2024-1234 on nginx',
  description: 'Remote code execution',
  remediation: 'Upgrade nginx',
  rawData: {},
  status: 'open',
  isNew: true,
  firstSeen: '2026-06-19T00:00:00.000Z',
  lastSeen: '2026-06-19T00:00:00.000Z',
  createdAt: '2026-06-19T00:00:00.000Z',
};

describe('suggestToolsForFinding', () => {
  it('suggests CVE and nuclei tools for critical findings', () => {
    const tools = suggestToolsForFinding(baseFinding);
    expect(tools).toContain('nuclei');
    expect(tools).toContain('open investigation case');
    expect(tools).toContain('draft remediation plan');
  });

  it('falls back to dashboard guidance for unknown types', () => {
    const tools = suggestToolsForFinding({
      ...baseFinding,
      findingType: 'unknown_type',
      tool: 'custom',
      severity: 'low',
      remediation: null,
    });
    expect(tools).toContain('review finding in Scout dashboard');
  });
});

describe('formatInvestigationBrief', () => {
  it('includes finding metadata and suggested tools', () => {
    const brief = formatInvestigationBrief(baseFinding, ['nuclei', 'security audit']);
    expect(brief).toContain('CVE-2024-1234 on nginx');
    expect(brief).toContain('Suggested next steps');
    expect(brief).toContain('nuclei');
  });
});
