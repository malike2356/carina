import {
  buildComplianceDashboard,
  collectAllFrameworks,
  complianceCollector,
  formatComplianceDashboard,
  formatComplianceReport,
  loadLatestReport,
  shouldBlockComplianceGaps,
} from './collector.js';
import { getFramework, parseFrameworkArg } from './controls.js';
import { loadDataProcessingRegistry } from './data-registry.js';
import { handleBreachNotification, formatBreachNotification } from './breach.js';
import { handleDSAR } from './dsar.js';
import { describeSsoReadiness } from './sso.js';
import type {
  ComplianceDashboard,
  ComplianceFrameworkId,
  ComplianceReport,
  DsarRequestType,
} from './types.js';

export async function runComplianceReview(options: {
  failOn?: 'warn' | 'fail';
  refresh?: boolean;
} = {}): Promise<ComplianceDashboard> {
  const dashboard = options.refresh
    ? await buildComplianceDashboard()
    : await buildComplianceDashboardFromCache();
  if (shouldBlockComplianceGaps(dashboard, options.failOn ?? 'fail')) {
    throw new Error(formatComplianceDashboard(dashboard));
  }
  return dashboard;
}

export async function buildComplianceDashboardFromCache(): Promise<ComplianceDashboard> {
  const ids: ComplianceFrameworkId[] = ['soc2', 'iso27001', 'gdpr'];
  const reports: ComplianceReport[] = [];
  for (const id of ids) {
    const cached = await loadLatestReport(id);
    if (cached) reports.push(cached);
  }
  if (reports.length === 0) {
    return buildComplianceDashboard();
  }
  return buildComplianceDashboard(reports);
}

export async function collectFramework(raw?: string): Promise<ComplianceReport | ComplianceReport[]> {
  const parsed = parseFrameworkArg(raw);
  if (parsed === 'all') return collectAllFrameworks();
  return complianceCollector.collect(parsed);
}

export async function generateComplianceReport(raw?: string): Promise<string> {
  const parsed = parseFrameworkArg(raw ?? 'all');
  if (parsed === 'all') {
    const reports = await collectAllFrameworks();
    return reports.map((report) => formatComplianceReport(report)).join('\n\n');
  }
  const report = await complianceCollector.collect(parsed);
  return formatComplianceReport(report);
}

export {
  buildComplianceDashboard,
  collectAllFrameworks,
  complianceCollector,
  formatComplianceDashboard,
  formatComplianceReport,
  loadLatestReport,
  shouldBlockComplianceGaps,
} from './collector.js';
export {
  getFramework,
  getControls,
  parseFrameworkArg,
  COMPLIANCE_FRAMEWORKS,
  COMPLIANCE_CONTROLS,
} from './controls.js';
export {
  loadDataProcessingRegistry,
  saveDataProcessingRegistry,
  DEFAULT_DATA_PROCESSING_REGISTRY,
} from './data-registry.js';
export {
  collectEvidenceForControl,
  recordPentestRunTimestamp,
} from './evidence-sources.js';
export {
  handleDSAR,
  collectUserData,
  verifyDeletion,
} from './dsar.js';
export {
  handleBreachNotification,
  formatBreachNotification,
  resolveComplianceIncident,
} from './breach.js';
export {
  describeSsoReadiness,
  listConfiguredSsoProviders,
  DEFAULT_SSO_PROVIDERS,
} from './sso.js';
export {
  buildScoutEvidencePayload,
  scoutComplianceSyncEnabled,
  scoutControlsForCarinaId,
  syncComplianceReportToScout,
} from './scout-sync.js';
export { _resetComplianceStoreForTests } from './collector.js';
export type {
  ComplianceDashboard,
  ComplianceEvidence,
  ComplianceFramework,
  ComplianceFrameworkId,
  ComplianceGap,
  ComplianceReport,
  ComplianceStatus,
  DsarRequestType,
  DsarResult,
  BreachNotification,
  EvidenceItem,
} from './types.js';
export type { SSOProvider } from './sso.js';
