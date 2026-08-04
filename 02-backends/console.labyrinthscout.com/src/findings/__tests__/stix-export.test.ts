import { describe, it, expect } from 'vitest';
import { buildStixBundle } from '../stix-export.js';
import type { Finding } from '../types.js';

const sampleFinding: Finding = {
  id: 'f1',
  scanRunId: null,
  targetId: 't1',
  accountId: 'a1',
  tool: 'nuclei',
  findingType: 'cve',
  severity: 'critical',
  cvssScore: 9.8,
  title: 'CVE-2024-1234',
  description: 'RCE',
  remediation: null,
  rawData: { host: 'example.com' },
  status: 'open',
  isNew: true,
  firstSeen: '2026-06-19T00:00:00.000Z',
  lastSeen: '2026-06-19T00:00:00.000Z',
  createdAt: '2026-06-19T00:00:00.000Z',
};

describe('stix-export', () => {
  it('builds STIX 2.1 bundle from findings', () => {
    const bundle = buildStixBundle([sampleFinding], { cveOnly: true });
    expect(bundle.type).toBe('bundle');
    expect(bundle.spec_version).toBe('2.1');
    expect(bundle.objects).toHaveLength(1);
    expect(bundle.objects[0]?.type).toBe('indicator');
    expect(bundle.objects[0]?.name).toBe('CVE-2024-1234');
  });

  it('filters non-CVE when cveOnly is true', () => {
    const bundle = buildStixBundle([
      sampleFinding,
      { ...sampleFinding, id: 'f2', findingType: 'open_port', severity: 'info', title: 'Port 443' },
    ], { cveOnly: true });
    expect(bundle.objects).toHaveLength(1);
  });
});
