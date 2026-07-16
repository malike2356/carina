import { loadWardenConfig } from '../config.js';
import { submitSample } from '../sandbox/submit.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

export async function sandboxThreat(threat: ThreatVerdict): Promise<ResponseResult> {
  const cfg = loadWardenConfig();
  const artifact = threat.signals.find((signal) => signal.artifactPath)?.artifactPath;
  const target = artifact ?? threat.id;

  if (!cfg.response.sandbox) {
    return { action: 'sandbox', target, ok: false, dryRun: cfg.dry_run, detail: 'Sandboxing is disabled' };
  }
  if (!artifact) {
    return { action: 'sandbox', target, ok: false, dryRun: cfg.dry_run, detail: 'No artifact to sandbox' };
  }
  if (cfg.dry_run) {
    return {
      action: 'sandbox',
      target,
      ok: true,
      dryRun: true,
      detail: `Would submit ${artifact} to the configured sandbox`,
    };
  }

  const result = await submitSample(artifact, { threatId: threat.id });
  return {
    action: 'sandbox',
    target,
    ok: result.ok,
    dryRun: false,
    detail: result.summary,
    evidence: { reportPath: result.reportPath, jobId: result.jobId },
  };
}
