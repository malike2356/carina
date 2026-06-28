import { config } from '../../config/index.js';
import { reportEvent } from '../../security/scout-client.js';
import type { AmbientCheck } from './types.js';
import { AmbientCheckEngine } from './check-engine.js';

export type AmbientDelivery = (check: AmbientCheck) => Promise<void>;

function prefixForCheck(check: AmbientCheck): string {
  switch (check.type) {
    case 'approaching_deadline': return 'Deadline reminder';
    case 'blocker_unresolved': return 'Blocker check';
    case 'stale_thread': return 'Following up';
    default: return 'Heads up';
  }
}

export function buildAmbientBlocks(check: AmbientCheck): unknown[] {
  const lines = [check.message];
  if (check.suggestedAction) lines.push(`Suggested action: ${check.suggestedAction}`);
  return [
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
  ];
}

export async function auditAmbientAction(check: AmbientCheck): Promise<void> {
  await reportEvent({
    event_type: 'ambient_check',
    source: 'carina_ambient',
    severity: check.priority === 'high' ? 'warning' : 'info',
    description: check.message,
    metadata: {
      channelId: check.channelId,
      channelName: check.channelName,
      checkType: check.type,
      sourceFactIds: check.sourceFactIds,
      suggestedAction: check.suggestedAction,
    },
  });
}

export async function deliverAmbientCheck(
  send: (channelId: string, text: string, blocks?: unknown[]) => Promise<void>,
  check: AmbientCheck,
): Promise<void> {
  const prefixed = `[${prefixForCheck(check)}] ${check.message}`;
  await send(check.channelId, prefixed, buildAmbientBlocks({ ...check, message: prefixed }));
  await auditAmbientAction(check);
}

export class AmbientScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly engine: AmbientCheckEngine;

  constructor(
    private readonly deliver: AmbientDelivery,
    private readonly checkIntervalMs = config.ambient.checkIntervalMs,
  ) {
    this.engine = new AmbientCheckEngine(checkIntervalMs);
  }

  start(intervalMs = this.checkIntervalMs): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async runCycle(): Promise<AmbientCheck[]> {
    const checks = await this.engine.runAmbientChecks();
    for (const check of checks) {
      await this.deliver({
        ...check,
        message: `[${prefixForCheck(check)}] ${check.message}`,
      });
      await auditAmbientAction(check);
    }
    return checks;
  }
}

export function createAmbientSchedulerTask(
  deliver: AmbientDelivery,
  intervalMinutes?: number,
): { name: string; intervalMinutes: number; run: () => Promise<void> } {
  const scheduler = new AmbientScheduler(deliver);
  const minutes = intervalMinutes ?? Math.max(1, Math.round(
    (Number(process.env.CARINA_AMBIENT_CHECK_INTERVAL_MS) || 2 * 60 * 60 * 1000) / 60_000,
  ));
  return {
    name: 'ambient-channel-checks',
    intervalMinutes: minutes,
    run: async () => {
      await scheduler.runCycle();
    },
  };
}
