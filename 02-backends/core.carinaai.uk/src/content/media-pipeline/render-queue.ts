/**
 * Background render queue for Property / YouTube Channel media.
 *
 * Runs inside carina-core (same container as the HTTP API). Media-pipeline
 * advance only enqueues jobs; this worker drains them with concurrency 1 by
 * default so Contabo CPU stays usable.
 */
import { config } from '../../config/index.js';
import { isChannelNicheId, type ChannelNicheId } from '../script-generator/niches.js';
import {
  getRenderJob,
  listQueuedRenderJobs,
  listStaleRenderingJobs,
  queueDepth,
  updateRenderJob,
} from './store.js';
import { runRenderJob } from './video-builder.js';
import { DEFAULT_RENDER_MAX_ATTEMPTS } from './types.js';
import { purgeExpiredMedia } from './retention.js';

let workerStarted = false;
let tickInFlight = false;
let activeJobId: string | null = null;

function concurrencyLimit(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_RENDER_CONCURRENCY ?? config.propertyChannel.renderConcurrency);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function pollIntervalMs(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_RENDER_POLL_MS ?? config.propertyChannel.renderPollMs);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : 15_000;
}

function staleRenderMs(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_RENDER_STALE_MS ?? config.propertyChannel.renderStaleMs);
  return Number.isFinite(n) && n >= 60_000 ? Math.floor(n) : 45 * 60_000;
}

function recoverStaleJobs(): number {
  let recovered = 0;
  for (const job of listStaleRenderingJobs(staleRenderMs())) {
    const attempts = (job.attempts ?? 0) + 1;
    const maxAttempts = job.maxAttempts ?? DEFAULT_RENDER_MAX_ATTEMPTS;
    if (attempts >= maxAttempts) {
      updateRenderJob(job.id, {
        status: 'failed',
        attempts,
        error: `Render timed out after ${Math.round(staleRenderMs() / 60_000)} minutes (attempt ${attempts}/${maxAttempts})`,
        renderingStartedAt: undefined,
      });
    } else {
      updateRenderJob(job.id, {
        status: 'queued',
        attempts,
        error: `Render timed out; re-queued (attempt ${attempts}/${maxAttempts})`,
        renderingStartedAt: undefined,
        progress: 0,
      });
    }
    recovered += 1;
    console.warn(
      `[property-channel-render] stale jobId=${job.id} channelId=${job.channelId} dayIndex=${job.dayIndex} attempts=${attempts}`,
    );
  }
  return recovered;
}

async function processOneJob(): Promise<boolean> {
  if (activeJobId) return false;
  const next = listQueuedRenderJobs()[0];
  if (!next) return false;

  const nicheRaw = next.niche ?? 'buy-to-let-investment';
  const niche: ChannelNicheId = isChannelNicheId(nicheRaw) ? nicheRaw : 'buy-to-let-investment';
  const attempts = (next.attempts ?? 0) + 1;
  const maxAttempts = next.maxAttempts ?? DEFAULT_RENDER_MAX_ATTEMPTS;

  activeJobId = next.id;
  updateRenderJob(next.id, {
    status: 'rendering',
    attempts,
    renderingStartedAt: new Date().toISOString(),
    error: undefined,
    progress: 5,
  });

  console.info(
    `[property-channel-render] start jobId=${next.id} channelId=${next.channelId} dayIndex=${next.dayIndex} attempt=${attempts}`,
  );

  try {
    const result = await runRenderJob(next.id, niche);
    if (result.status === 'ready') {
      console.info(
        `[property-channel-render] ready jobId=${next.id} channelId=${next.channelId} dayIndex=${next.dayIndex} video=${result.assets.videoPath ?? ''}`,
      );
    } else if (result.status === 'failed') {
      if (attempts < maxAttempts) {
        updateRenderJob(next.id, {
          status: 'queued',
          error: result.error,
          renderingStartedAt: undefined,
          progress: 0,
        });
        console.warn(
          `[property-channel-render] failed-requeue jobId=${next.id} attempt=${attempts}/${maxAttempts} error=${result.error ?? ''}`,
        );
      } else {
        console.warn(
          `[property-channel-render] failed jobId=${next.id} attempt=${attempts}/${maxAttempts} error=${result.error ?? ''}`,
        );
      }
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (attempts < maxAttempts) {
      updateRenderJob(next.id, {
        status: 'queued',
        error: message,
        renderingStartedAt: undefined,
        progress: 0,
      });
    } else {
      updateRenderJob(next.id, {
        status: 'failed',
        error: message,
        renderingStartedAt: undefined,
      });
    }
    console.warn(`[property-channel-render] exception jobId=${next.id} error=${message}`);
    return true;
  } finally {
    activeJobId = null;
  }
}

export async function drainRenderQueueOnce(limit = concurrencyLimit()): Promise<{
  processed: number;
  recovered: number;
  depth: ReturnType<typeof queueDepth>;
}> {
  const recovered = recoverStaleJobs();
  let processed = 0;
  const cap = Math.max(1, limit);
  while (processed < cap) {
    const did = await processOneJob();
    if (!did) break;
    processed += 1;
  }
  const depth = queueDepth();
  console.info(
    `[property-channel-render] tick processed=${processed} recovered=${recovered} queued=${depth.queued} rendering=${depth.rendering} ready=${depth.ready} failed=${depth.failed}`,
  );
  return { processed, recovered, depth };
}

export function getRenderQueueSnapshot() {
  return {
    activeJobId,
    depth: queueDepth(),
    concurrency: concurrencyLimit(),
    pollIntervalMs: pollIntervalMs(),
    lastError: getRenderJob(activeJobId ?? '')?.error ?? null,
  };
}

export function startPropertyChannelRenderWorker(): void {
  if (workerStarted || process.env.PROPERTY_CHANNEL_RENDER_WORKER === 'false') return;
  workerStarted = true;
  const interval = pollIntervalMs();

  const tick = () => {
    if (tickInFlight) return;
    tickInFlight = true;
    void drainRenderQueueOnce()
      .then(() => {
        try {
          purgeExpiredMedia();
        } catch (err) {
          console.warn('[property-channel-render] retention failed', err);
        }
      })
      .catch((err) => console.warn('[property-channel-render] tick failed', err))
      .finally(() => {
        tickInFlight = false;
      });
  };

  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, interval).unref?.();
  console.info(`[property-channel-render] worker started pollMs=${interval} concurrency=${concurrencyLimit()}`);
}

/** Test helper: reset module worker state. */
export function __resetRenderWorkerForTests(): void {
  workerStarted = false;
  tickInFlight = false;
  activeJobId = null;
}
