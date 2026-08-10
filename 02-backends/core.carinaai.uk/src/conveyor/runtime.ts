/**
 * Carina ops glue for the conveyor audit.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateFixesForReport,
  pipelineStatus,
  runFullAudit,
  runPipeline,
  type AuditReport,
} from './index.js';

export function defaultCarinaAuditRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function auditCarinaCore(projectPath = defaultCarinaAuditRoot()): {
  report: AuditReport;
  fixes: ReturnType<typeof generateFixesForReport>;
} {
  const report = runFullAudit(projectPath);
  return { report, fixes: generateFixesForReport(report.layers) };
}

export async function runCarinaConveyorPipeline(
  targetEnv: string,
  opts?: { humanApproval?: boolean; projectPath?: string },
) {
  return runPipeline(opts?.projectPath ?? defaultCarinaAuditRoot(), targetEnv, {
    humanApproval: opts?.humanApproval === true,
  });
}

export { pipelineStatus };
