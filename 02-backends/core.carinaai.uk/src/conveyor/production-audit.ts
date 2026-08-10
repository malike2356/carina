/**
 * 13-layer production readiness audit (filesystem-based).
 */
import { createAuditContext, DEFAULT_THRESHOLD, type AuditReport, type LayerResult } from './types.js';
import {
  checkAccessibility,
  checkBackup,
  checkCompliance,
  checkDeployment,
  checkEnvironment,
  checkErrorHandling,
  checkLogging,
  checkMonitoring,
  checkPerformance,
  checkRateLimiting,
  checkSecrets,
  checkSecurity,
  checkSessions,
} from './layers/index.js';

const LAYER_RUNNERS = [
  checkSecurity,
  checkErrorHandling,
  checkEnvironment,
  checkLogging,
  checkMonitoring,
  checkRateLimiting,
  checkSecrets,
  checkSessions,
  checkAccessibility,
  checkCompliance,
  checkPerformance,
  checkBackup,
  checkDeployment,
] as const;

export function runFullAudit(
  projectPath: string,
  opts?: { threshold?: number },
): AuditReport {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const ctx = createAuditContext(projectPath);
  const layers: LayerResult[] = LAYER_RUNNERS.map((run) => run(ctx));
  const overallScore = Math.round(
    layers.reduce((sum, layer) => sum + layer.score, 0) / Math.max(layers.length, 1),
  );
  const criticalFailures = layers.filter((l) => l.critical && l.score < threshold);
  const passed = criticalFailures.length === 0;
  return {
    projectPath: ctx.root,
    checkedAt: new Date().toISOString(),
    layers,
    overallScore,
    passed,
    threshold,
    criticalFailures,
    summary: passed
      ? `Passed: all critical layers score >= ${threshold} (overall ${overallScore}).`
      : `Failed: ${criticalFailures.length} critical layer(s) below ${threshold} (overall ${overallScore}).`,
  };
}

export function listLayerIds(): string[] {
  return LAYER_RUNNERS.map((fn) => fn.name.replace(/^check/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''));
}
