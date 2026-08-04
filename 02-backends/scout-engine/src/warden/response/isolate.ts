import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadWardenConfig } from '../config.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

export async function isolateThreat(threat: ThreatVerdict): Promise<ResponseResult> {
  const cfg = loadWardenConfig();
  const artifacts = [...new Set(
    threat.signals.map((signal) => signal.artifactPath).filter((value): value is string => Boolean(value)),
  )];
  const target = artifacts[0] ?? threat.id;

  if (!cfg.response.isolate) {
    return { action: 'isolate', target, ok: false, dryRun: cfg.dry_run, detail: 'Isolation is disabled' };
  }
  if (artifacts.length === 0) {
    return { action: 'isolate', target, ok: false, dryRun: cfg.dry_run, detail: 'No artifact to isolate' };
  }
  if (cfg.dry_run) {
    return {
      action: 'isolate',
      target,
      ok: true,
      dryRun: true,
      detail: `Would move ${artifacts.length} artifact(s) into quarantine`,
    };
  }

  const isolated: string[] = [];
  const errors: string[] = [];
  fs.mkdirSync(cfg.quarantine_dir, { recursive: true, mode: 0o700 });
  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact)) {
      errors.push(`${artifact}: not found`);
      continue;
    }
    const destination = path.join(
      cfg.quarantine_dir,
      `${randomUUID()}-${path.basename(artifact)}`,
    );
    try {
      try {
        fs.renameSync(artifact, destination);
      } catch {
        fs.copyFileSync(artifact, destination);
        fs.unlinkSync(artifact);
      }
      fs.chmodSync(destination, 0o600);
      isolated.push(destination);
    } catch (error) {
      errors.push(`${artifact}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    action: 'isolate',
    target,
    ok: isolated.length > 0 && errors.length === 0,
    dryRun: false,
    detail: isolated.length
      ? `Isolated ${isolated.length} artifact(s)${errors.length ? `; ${errors.join('; ')}` : ''}`
      : `Isolation failed: ${errors.join('; ')}`,
    evidence: { isolated },
  };
}
