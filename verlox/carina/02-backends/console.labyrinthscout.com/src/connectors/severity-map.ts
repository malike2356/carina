import type { ScoutFindingSeverity } from './types.js';

export const SCOUT_TO_VENDOR_SEVERITY: Record<string, Record<ScoutFindingSeverity, string>> = {
  sentinelone: {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Suspicious',
  },
  crowdstrike: {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Informational',
  },
  defender: {
    critical: 'high',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'informational',
  },
  wiz: {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFORMATIONAL',
  },
  snyk: {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'note',
  },
  jira: {
    critical: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    info: 'Lowest',
  },
  pagerduty: {
    critical: 'critical',
    high: 'error',
    medium: 'warning',
    low: 'info',
    info: 'info',
  },
  servicenow: {
    critical: '1',
    high: '2',
    medium: '3',
    low: '4',
    info: '5',
  },
};

export function mapVendorSeverity(
  connectorId: string,
  severity: ScoutFindingSeverity,
  fallback = 'medium',
): string {
  return SCOUT_TO_VENDOR_SEVERITY[connectorId]?.[severity] ?? fallback;
}

export const FINDING_SEVERITY_RANK: Record<ScoutFindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function meetsMinSeverity(
  severity: ScoutFindingSeverity,
  minSeverity: ScoutFindingSeverity,
): boolean {
  return FINDING_SEVERITY_RANK[severity] <= FINDING_SEVERITY_RANK[minSeverity];
}
