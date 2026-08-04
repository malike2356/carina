import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

export async function stripThreat(threat: ThreatVerdict): Promise<ResponseResult> {
  const cfg = loadWardenConfig();
  const artifacts = [...new Set(
    threat.signals.map((signal) => signal.artifactPath).filter((value): value is string => Boolean(value)),
  )];
  const target = artifacts[0] ?? threat.id;

  if (!cfg.response.strip) {
    return { action: 'strip', target, ok: false, dryRun: cfg.dry_run, detail: 'Capability stripping is disabled' };
  }
  if (artifacts.length === 0) {
    return { action: 'strip', target, ok: false, dryRun: cfg.dry_run, detail: 'No artifact to strip' };
  }
  if (cfg.dry_run) {
    return {
      action: 'strip',
      target,
      ok: true,
      dryRun: true,
      detail: `Would remove executable permissions from ${artifacts.length} artifact(s)`,
    };
  }

  const stripped: string[] = [];
  const errors: string[] = [];
  for (const artifact of artifacts) {
    try {
      const mode = fs.statSync(artifact).mode & 0o777;
      fs.chmodSync(artifact, mode & ~0o111);
      stripped.push(artifact);
    } catch (error) {
      errors.push(`${artifact}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    action: 'strip',
    target,
    ok: stripped.length > 0 && errors.length === 0,
    dryRun: false,
    detail: stripped.length
      ? `Stripped executable permissions from ${stripped.length} artifact(s)${errors.length ? `; ${errors.join('; ')}` : ''}`
      : `Capability stripping failed: ${errors.join('; ')}`,
    evidence: { stripped },
  };
}
