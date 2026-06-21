import {
  formatDependencyScanSummary,
  runDependencyAudit,
  scanDependencies,
  shouldBlockDependencyScan,
} from './dependency-scan.js';
import { resolveProjectRoot, sbomOutputPath } from './paths.js';
import {
  checkProvenance,
  formatProvenanceSummary,
  shouldBlockProvenance,
} from './provenance.js';
import {
  formatSbomSummary,
  generateSbom,
  writeSbom,
} from './sbom.js';
import type { SupplyChainReport } from './types.js';

export async function runSupplyChainReview(options: {
  projectRoot?: string;
  includeSbom?: boolean;
  includeDependencyScan?: boolean;
  failOn?: 'critical' | 'high';
} = {}): Promise<SupplyChainReport> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const report: SupplyChainReport = { generatedAt: new Date().toISOString() };

  if (options.includeSbom !== false) {
    report.sbom = await generateSbom(projectRoot);
  }
  if (options.includeDependencyScan !== false) {
    report.dependencyScan = await scanDependencies(projectRoot);
  }
  return report;
}

export function shouldBlockSupplyChain(
  report: SupplyChainReport,
  failOn: 'critical' | 'high' = 'critical',
): boolean {
  if (!report.dependencyScan) return false;
  return shouldBlockDependencyScan(report.dependencyScan, failOn);
}

export {
  generateSbom,
  writeSbom,
  formatSbomSummary,
  scanDependencies,
  runDependencyAudit,
  formatDependencyScanSummary,
  shouldBlockDependencyScan,
  checkProvenance,
  formatProvenanceSummary,
  shouldBlockProvenance,
  resolveProjectRoot,
  sbomOutputPath,
};
