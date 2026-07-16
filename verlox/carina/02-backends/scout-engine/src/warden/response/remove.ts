import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

export async function removeThreat(
  threat: ThreatVerdict,
  opts: { confirmed?: boolean } = {},
): Promise<ResponseResult> {
  const cfg = loadWardenConfig();
  const artifacts = [...new Set(
    threat.signals.map((signal) => signal.artifactPath).filter((value): value is string => Boolean(value)),
  )];
  const target = artifacts[0] ?? threat.id;
  const automaticCriticalRemoval =
    cfg.response.critical_high_auto_remove &&
    threat.severity === 'critical' &&
    threat.confidenceBand === 'high';
  const authorized =
    !cfg.response.remove_requires_confirmation || opts.confirmed || automaticCriticalRemoval;

  if (!authorized) {
    return {
      action: 'remove',
      target,
      ok: false,
      dryRun: cfg.dry_run,
      detail: 'Removal requires explicit operator confirmation',
    };
  }
  if (artifacts.length === 0) {
    return { action: 'remove', target, ok: false, dryRun: cfg.dry_run, detail: 'No artifact to remove' };
  }
  if (cfg.dry_run) {
    return {
      action: 'remove',
      target,
      ok: true,
      dryRun: true,
      detail: `Would remove ${artifacts.length} confirmed artifact(s)`,
    };
  }

  const removed: string[] = [];
  const errors: string[] = [];
  for (const artifact of artifacts) {
    try {
      fs.rmSync(artifact, { recursive: false, force: false });
      removed.push(artifact);
    } catch (error) {
      errors.push(`${artifact}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    action: 'remove',
    target,
    ok: removed.length > 0 && errors.length === 0,
    dryRun: false,
    detail: removed.length
      ? `Removed ${removed.length} artifact(s)${errors.length ? `; ${errors.join('; ')}` : ''}`
      : `Removal failed: ${errors.join('; ')}`,
    evidence: { removed },
  };
}
