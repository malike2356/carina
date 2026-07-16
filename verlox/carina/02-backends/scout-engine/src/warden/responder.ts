// Automated response orchestrator
import { isolateThreat } from './response/isolate.js';
import { sandboxThreat } from './response/sandbox.js';
import { immobilizeThreat } from './response/immobilize.js';
import { stripThreat } from './response/strip.js';
import { removeThreat } from './response/remove.js';
import { killswitchThreat } from './response/killswitch.js';
import { maybeSendAlerts, writeThreatReport } from './reporter.js';
import type { ResponseResult, ThreatVerdict, WardenEvent } from './types.js';

export async function respondToThreat(
  threat: ThreatVerdict,
  opts: { confirmedRemove?: boolean; instanceId?: string } = {},
): Promise<{ responses: ResponseResult[]; event: WardenEvent }> {
  const responses: ResponseResult[] = [];
  threat.status = 'responding';
  threat.updatedAt = new Date().toISOString();

  for (const action of threat.actions) {
    if (action === 'log' || action === 'flag') {
      responses.push({
        action,
        target: threat.id,
        ok: true,
        dryRun: false,
        detail: action === 'flag' ? 'Flagged for operator review' : 'Logged',
      });
      continue;
    }
    if (action === 'isolate') responses.push(await isolateThreat(threat));
    else if (action === 'sandbox') responses.push(await sandboxThreat(threat));
    else if (action === 'immobilize') responses.push(await immobilizeThreat(threat));
    else if (action === 'strip') responses.push(await stripThreat(threat));
    else if (action === 'remove') {
      responses.push(await removeThreat(threat, { confirmed: opts.confirmedRemove }));
    } else if (action === 'kill_carina' || action === 'lock_host') {
      // handled once below
    }
  }

  if (threat.actions.includes('kill_carina') || threat.actions.includes('lock_host')) {
    responses.push(
      ...(await killswitchThreat(threat, {
        instanceId: opts.instanceId,
        lockHost: threat.actions.includes('lock_host'),
      })),
    );
  }

  const removed = responses.some((r) => r.action === 'remove' && r.ok && !r.dryRun);
  const isolated = responses.some((r) => r.action === 'isolate' && r.ok);
  threat.status = removed ? 'removed' : isolated ? 'contained' : 'open';
  threat.updatedAt = new Date().toISOString();

  const event = writeThreatReport(threat, responses);
  threat.reportId = event.id;
  await maybeSendAlerts(event);

  return { responses, event };
}
