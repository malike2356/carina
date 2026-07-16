// Carina + host kill-switch integration
import { loadWardenConfig } from '../config.js';
import type { ResponseResult, ThreatVerdict } from '../types.js';

async function trySuspend(instanceId: string, reason: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const mod = await import('../../control/instance-control.js');
    const result = await mod.suspendInstance(instanceId, reason);
    if (result.ok) {
      return { ok: true, detail: `Carina instance ${instanceId} suspended via kill-switch` };
    }
    return { ok: false, detail: result.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `Kill-switch unavailable: ${msg}` };
  }
}

export async function killswitchThreat(
  threat: ThreatVerdict,
  opts: { instanceId?: string; lockHost?: boolean } = {},
): Promise<ResponseResult[]> {
  const cfg = loadWardenConfig();
  const results: ResponseResult[] = [];
  const instanceId =
    opts.instanceId ||
    (threat.signals.find((s) => typeof s.evidence.instanceId === 'string')?.evidence
      .instanceId as string | undefined);

  if (cfg.dry_run || !cfg.kill_switch_on_critical) {
    results.push({
      action: 'kill_carina',
      target: instanceId || 'unknown',
      ok: true,
      dryRun: true,
      detail: `Would activate Carina kill-switch for threat ${threat.id}`,
    });
  } else if (instanceId) {
    const suspended = await trySuspend(
      instanceId,
      `WARDEN critical threat ${threat.id}: ${threat.title}`,
    );
    results.push({
      action: 'kill_carina',
      target: instanceId,
      ok: suspended.ok,
      dryRun: false,
      detail: suspended.detail,
    });
  } else {
    results.push({
      action: 'kill_carina',
      target: 'unknown',
      ok: false,
      dryRun: false,
      detail: 'No Carina instance id on threat signals',
    });
  }

  if (opts.lockHost || threat.actions.includes('lock_host')) {
    results.push({
      action: 'lock_host',
      target: 'host',
      ok: true,
      dryRun: cfg.dry_run,
      detail: cfg.dry_run
        ? 'Would restrict host network to Scout-only and flag for OS reinstall'
        : 'Host lock flagged; operator must complete remediation (OS reinstall if kernel compromise)',
    });
  }

  return results;
}
