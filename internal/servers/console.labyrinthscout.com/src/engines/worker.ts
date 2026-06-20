import { runEngine } from './registry.js';
import {
  claimNextQueuedScan,
  completeScanRun,
  createFinding,
  failScanRun,
} from '../findings/store.js';
import { getCurrentScoutScore } from '../findings/score.js';
import type { EngineFinding } from './types.js';

const POLL_INTERVAL_MS = 5_000;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;

async function persistFindings(
  accountId: string,
  targetId: string,
  scanRunId: string,
  findings: EngineFinding[],
): Promise<number> {
  let count = 0;
  for (const finding of findings) {
    const created = await createFinding({
      accountId,
      targetId,
      scanRunId,
      tool: finding.tool,
      findingType: finding.findingType,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      remediation: finding.remediation,
      cvssScore: finding.cvssScore,
      rawData: finding.rawData,
    });
    if (created) count += 1;
  }
  return count;
}

async function processNextScan(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const scan = await claimNextQueuedScan();
    if (!scan) return;

    try {
      const { findings, engine } = await runEngine(
        scan.tool,
        scan.target,
        scan.targetType,
        scan.accountId,
        scan.targetId,
      );
      const count = await persistFindings(scan.accountId, scan.targetId, scan.id, findings);
      await completeScanRun(scan.id, count);
      await getCurrentScoutScore(scan.accountId, true);
      console.log(`[scout:scan-worker] ${scan.tool} (${engine}) on ${scan.target}: ${count} finding(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await failScanRun(scan.id, msg);
      console.error(`[scout:scan-worker] ${scan.id} failed:`, msg);
    }
  } finally {
    processing = false;
  }
}

export function startScanWorker(): void {
  if (workerTimer) return;
  void processNextScan();
  workerTimer = setInterval(() => void processNextScan(), POLL_INTERVAL_MS);
  console.log('[scout:scan-worker] Started (poll every 5s)');
}

export function stopScanWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

export async function runScanWorkerOnce(): Promise<void> {
  await processNextScan();
}
