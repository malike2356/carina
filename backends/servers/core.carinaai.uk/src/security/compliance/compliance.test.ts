import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetSecurityAuditForTests, appendSecurityAudit } from '../security-audit.js';
import {
  _resetComplianceStoreForTests,
  buildComplianceDashboard,
  collectFramework,
  complianceCollector,
  formatComplianceDashboard,
  formatComplianceReport,
  handleDSAR,
  loadDataProcessingRegistry,
  parseFrameworkArg,
  shouldBlockComplianceGaps,
} from './index.js';
import { recordPentestRunTimestamp } from './evidence-sources.js';

describe('compliance controls', () => {
  it('parses framework CLI arguments', () => {
    expect(parseFrameworkArg('soc2')).toBe('soc2');
    expect(parseFrameworkArg('iso')).toBe('iso27001');
    expect(parseFrameworkArg('all')).toBe('all');
  });
});

describe('ComplianceCollector', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `carina-compliance-${Date.now()}`);
    process.env.CARINA_HOME = tmpHome;
    await _resetComplianceStoreForTests();
    _resetSecurityAuditForTests();
    appendSecurityAudit({
      category: 'tool_rbac',
      action: 'deny',
      detail: 'test audit event',
    });
    await recordPentestRunTimestamp(Date.now());
  });

  afterEach(async () => {
    await _resetComplianceStoreForTests();
    _resetSecurityAuditForTests();
  });

  it('loads default GDPR data processing registry', async () => {
    const registry = await loadDataProcessingRegistry();
    expect(registry.activities.length).toBeGreaterThan(0);
  });

  it('collects SOC 2 evidence and computes score', async () => {
    const report = await collectFramework('soc2');
    expect(Array.isArray(report)).toBe(false);
    if (Array.isArray(report)) return;
    expect(report.framework.id).toBe('soc2');
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.scorePercent).toBeGreaterThan(0);
    expect(formatComplianceReport(report)).toContain('SOC 2');
  });

  it('builds dashboard across all frameworks', async () => {
    const dashboard = await buildComplianceDashboard();
    expect(dashboard.frameworks.length).toBe(3);
    expect(formatComplianceDashboard(dashboard)).toContain('COMPLIANCE DASHBOARD');
  });

  it('assesses control status from collector output', () => {
    expect(complianceCollector.assessStatus(true, 1)).toBe('compliant');
    expect(complianceCollector.assessStatus(false, 1)).toBe('non_compliant');
    expect(complianceCollector.assessStatus(true, 0)).toBe('non_compliant');
  });

  it('handles DSAR access export', async () => {
    const result = await handleDSAR('user-test-1', 'access');
    expect(result.requestType).toBe('access');
    expect(result.exportPath).toBeTruthy();
    if (result.exportPath) {
      expect(fs.existsSync(result.exportPath)).toBe(true);
    }
  });

  it('blocks CI when fail-severity gaps exist', async () => {
    const dashboard = await buildComplianceDashboard();
    const withFail = {
      ...dashboard,
      gaps: [{ ...dashboard.gaps[0], severity: 'fail' as const }].filter(Boolean),
    };
    if (withFail.gaps.length > 0) {
      expect(shouldBlockComplianceGaps(withFail, 'fail')).toBe(true);
    } else {
      expect(shouldBlockComplianceGaps(dashboard, 'fail')).toBe(false);
    }
  });
});
