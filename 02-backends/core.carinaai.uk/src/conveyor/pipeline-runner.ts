/**
 * Prototype-to-production pipeline: audit → propose fixes → validate → gated deploy.
 * Fixes are never applied without explicit humanApproval=true.
 */
import { generateFixesForReport } from './fix-generator.js';
import { runFullAudit } from './production-audit.js';
import type { AuditReport, FixProposal, PipelineStatus } from './types.js';

let lastStatus: PipelineStatus = {
  state: 'idle',
  targetEnv: 'none',
  message: 'Conveyor idle',
  updatedAt: new Date().toISOString(),
};

function setStatus(partial: Partial<PipelineStatus>): PipelineStatus {
  lastStatus = {
    ...lastStatus,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  return lastStatus;
}

export function pipelineStatus(): PipelineStatus {
  return { ...lastStatus };
}

export type PipelineResult = {
  status: PipelineStatus;
  report: AuditReport;
  fixes: FixProposal[];
  deployed: boolean;
};

export async function runPipeline(
  projectPath: string,
  targetEnv: string,
  opts?: {
    humanApproval?: boolean;
    deployFn?: (env: string, report: AuditReport) => Promise<void> | void;
    threshold?: number;
  },
): Promise<PipelineResult> {
  setStatus({ state: 'auditing', targetEnv, message: 'Running 13-layer audit' });
  const report = runFullAudit(projectPath, { threshold: opts?.threshold });

  setStatus({ state: 'fixing', report, message: 'Generating fix proposals (not applied)' });
  const fixes = generateFixesForReport(report.layers);

  setStatus({
    state: 'validating',
    report,
    fixes,
    message: report.passed ? 'Critical layers passed threshold' : 'Critical layers below threshold',
  });

  if (!report.passed) {
    const status = setStatus({
      state: 'failed',
      report,
      fixes,
      message: `Pipeline failed: ${report.summary}`,
    });
    return { status, report, fixes, deployed: false };
  }

  if (!opts?.humanApproval) {
    const status = setStatus({
      state: 'awaiting_approval',
      report,
      fixes,
      message: 'Audit passed critical threshold; set humanApproval=true to deploy.',
    });
    return { status, report, fixes, deployed: false };
  }

  if (opts.deployFn) {
    setStatus({ state: 'deploying', report, fixes, message: `Deploying to ${targetEnv}` });
    await opts.deployFn(targetEnv, report);
  }

  const status = setStatus({
    state: 'passed',
    report,
    fixes,
    message: `Pipeline passed for ${targetEnv}`,
  });
  return { status, report, fixes, deployed: Boolean(opts.deployFn) };
}
