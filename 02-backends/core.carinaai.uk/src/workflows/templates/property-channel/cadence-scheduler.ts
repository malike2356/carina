/**
 * Cadence scheduler: periodically advances running YouTube Channel workflows
 * so media enqueue + upload + comment/analytics ticks without manual Advance.
 */
import { config } from '../../../config/index.js';
import { listAllPropertyChannelRuns } from './store.js';
import { advancePropertyChannelWorkflow } from './template.js';
import { lastRenderError, queueDepth } from '../../../content/media-pipeline/store.js';
import { canAfford, getQuotaUsage } from '../../../connectors/youtube/quota.js';

let started = false;
let tickInFlight = false;

function tickMs(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_CADENCE_TICK_MS ?? config.propertyChannel.cadenceTickMs);
  return Number.isFinite(n) && n >= 30_000 ? Math.floor(n) : 300_000;
}

export function estimateNextRenderAt(now = new Date()): string {
  // Worker poll + one cadence window ahead.
  const poll = Number(process.env.PROPERTY_CHANNEL_RENDER_POLL_MS ?? config.propertyChannel.renderPollMs) || 15_000;
  return new Date(now.getTime() + poll).toISOString();
}

export function estimateNextUploadAt(channelId: string, publishTime: string, now = new Date()): string {
  const [hh, mm] = publishTime.split(':').map((p) => Number(p));
  const next = new Date(now);
  next.setUTCHours(hh || 18, mm || 30, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  if (!canAfford(channelId, 'videos.insert')) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

export function getChannelCadenceStatus(opts: {
  workspaceId: string;
  channelId: string;
  publishTime?: string;
}) {
  const depth = queueDepth();
  return {
    queueDepth: depth,
    lastRenderError: lastRenderError(opts.workspaceId, opts.channelId),
    nextRenderAt: estimateNextRenderAt(),
    nextUploadAt: estimateNextUploadAt(
      opts.channelId,
      opts.publishTime ?? config.propertyChannel.defaultPublishTime,
    ),
    maxRendersPerDay: config.propertyChannel.maxRendersPerDay,
    maxUploadsPerDay: config.propertyChannel.maxUploadsPerDay,
    quota: getQuotaUsage(opts.channelId),
  };
}

export async function runPropertyChannelCadenceTick(): Promise<{ advanced: number; errors: number }> {
  const runs = listAllPropertyChannelRuns().filter((r) => r.status === 'running' || r.status === 'queued');
  let advanced = 0;
  let errors = 0;
  for (const run of runs) {
    try {
      await advancePropertyChannelWorkflow(run.id);
      advanced += 1;
    } catch (err) {
      errors += 1;
      console.warn(
        `[property-channel-cadence] advance failed runId=${run.id} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.info(`[property-channel-cadence] tick advanced=${advanced} errors=${errors} runs=${runs.length}`);
  return { advanced, errors };
}

export function startPropertyChannelCadenceScheduler(): void {
  if (started || process.env.PROPERTY_CHANNEL_CADENCE_SCHEDULER === 'false') return;
  started = true;
  const interval = tickMs();
  const tick = () => {
    if (tickInFlight) return;
    tickInFlight = true;
    void runPropertyChannelCadenceTick()
      .catch((err) => console.warn('[property-channel-cadence] tick failed', err))
      .finally(() => {
        tickInFlight = false;
      });
  };
  setTimeout(tick, 45_000).unref?.();
  setInterval(tick, interval).unref?.();
  console.info(`[property-channel-cadence] scheduler started tickMs=${interval}`);
}
