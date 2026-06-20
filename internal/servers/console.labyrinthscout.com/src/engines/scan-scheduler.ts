import { listDueScanConfigs, markScanConfigRun } from '../findings/scan-config.js';
import { queueScanRun } from '../findings/store.js';
import type { ScanSchedule } from './registry.js';

const SCHEDULER_INTERVAL_MS = 60_000;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

async function tickScheduler(): Promise<void> {
  try {
    const due = await listDueScanConfigs(25);
    for (const config of due) {
      const scan = await queueScanRun(config.accountId, config.targetId, config.tool);
      if (scan) {
        await markScanConfigRun(config.id, config.schedule as ScanSchedule);
        console.log(`[scout:scan-scheduler] Queued ${config.tool} for ${config.target}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:scan-scheduler] tick failed:', msg);
  }
}

export function startScanScheduler(): void {
  if (schedulerTimer) return;
  setTimeout(() => void tickScheduler(), 10_000);
  schedulerTimer = setInterval(() => void tickScheduler(), SCHEDULER_INTERVAL_MS);
  console.log('[scout:scan-scheduler] Started (tick every 60s)');
}

export function stopScanScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export async function runScanSchedulerOnce(): Promise<void> {
  await tickScheduler();
}
