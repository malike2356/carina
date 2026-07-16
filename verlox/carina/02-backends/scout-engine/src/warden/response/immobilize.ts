import { loadWardenConfig } from '../config.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

export async function immobilizeThreat(threat: ThreatVerdict): Promise<ResponseResult> {
  const cfg = loadWardenConfig();
  const processIds = [...new Set(
    threat.signals
      .map((signal) => signal.processId)
      .filter((pid): pid is number => Number.isInteger(pid) && Number(pid) > 1 && pid !== process.pid),
  )];
  const target = processIds.length ? processIds.join(',') : threat.id;

  if (!cfg.response.immobilize) {
    return { action: 'immobilize', target, ok: false, dryRun: cfg.dry_run, detail: 'Immobilization is disabled' };
  }
  if (processIds.length === 0) {
    return { action: 'immobilize', target, ok: false, dryRun: cfg.dry_run, detail: 'No safe process id to immobilize' };
  }
  if (cfg.dry_run) {
    return {
      action: 'immobilize',
      target,
      ok: true,
      dryRun: true,
      detail: `Would suspend ${processIds.length} process(es) with SIGSTOP`,
    };
  }

  const stopped: number[] = [];
  const errors: string[] = [];
  for (const pid of processIds) {
    try {
      process.kill(pid, 'SIGSTOP');
      stopped.push(pid);
    } catch (error) {
      errors.push(`${pid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {
    action: 'immobilize',
    target,
    ok: stopped.length > 0 && errors.length === 0,
    dryRun: false,
    detail: stopped.length
      ? `Suspended ${stopped.length} process(es)${errors.length ? `; ${errors.join('; ')}` : ''}`
      : `Immobilization failed: ${errors.join('; ')}`,
    evidence: { stopped },
  };
}
