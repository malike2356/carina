import { describe, expect, it } from 'vitest';
import { parseNpmAuditReport } from '../automated-review/dependency-scan.js';
import {
  formatSbomSummary,
  generateSbom,
} from './sbom.js';
import {
  formatDependencyScanSummary,
  scanDependencies,
  shouldBlockDependencyScan,
} from './dependency-scan.js';
import { checkProvenance, shouldBlockProvenance } from './provenance.js';
import { resolveProjectRoot } from './paths.js';
import { runSupplyChainReview, shouldBlockSupplyChain } from './index.js';

describe('supply chain SBOM', () => {
  it('generates SPDX package list from project manifest and lockfile', async () => {
    const root = resolveProjectRoot();
    const sbom = await generateSbom(root);
    expect(sbom.spdxVersion).toBe('SPDX-2.3');
    expect(sbom.packages.length).toBeGreaterThan(1);
    expect(sbom.relationships.some((row) => row.relationshipType === 'DESCRIBES')).toBe(true);
    expect(formatSbomSummary(sbom)).toContain('Packages:');
  });
});

describe('supply chain dependency scan', () => {
  it('maps audit advisories to findings', () => {
    const findings = parseNpmAuditReport({
      advisories: {
        1: {
          severity: 'critical',
          title: 'Prototype pollution',
          module_name: 'lodash',
          url: 'https://example.com/advisory',
        },
      },
    });
    expect(findings[0]?.severity).toBe('critical');
  });

  it('blocks on critical findings when configured', () => {
    expect(shouldBlockDependencyScan({
      scannedAt: new Date().toISOString(),
      projectRoot: '.',
      findings: [],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
      verdict: 'blocked',
    }, 'critical')).toBe(true);
  });

  it('runs dependency scan against core project', async () => {
    const report = await scanDependencies(resolveProjectRoot());
    expect(['clean', 'warning', 'blocked']).toContain(report.verdict);
    expect(formatDependencyScanSummary(report)).toContain('Dependency scan');
  });
});

describe('supply chain provenance', () => {
  it('checks built-in property-uk pack provenance', async () => {
    const check = await checkProvenance('property-uk');
    expect(check.version).not.toBe('unknown');
    expect(['allowed', 'warning', 'blocked']).toContain(check.verdict);
    if (check.verdict === 'blocked') {
      expect(shouldBlockProvenance(check)).toBe(true);
    }
  });

  it('blocks unknown skill names', async () => {
    const check = await checkProvenance('this-pack-does-not-exist-xyz');
    expect(check.verdict).toBe('blocked');
    expect(check.flags).toContain('not_installed');
  });
});

describe('supply chain review', () => {
  it('runs combined SBOM and dependency scan', async () => {
    const report = await runSupplyChainReview({ projectRoot: resolveProjectRoot() });
    expect(report.sbom?.packages.length).toBeGreaterThan(0);
    expect(report.dependencyScan).toBeDefined();
    expect(typeof shouldBlockSupplyChain(report, 'critical')).toBe('boolean');
  });
});
