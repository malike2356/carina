import { config } from '../config/index.js';
import { runBillingReconciliation } from './reconciliation-job.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startBillingReconciliationSchedule(): void {
  if (process.env.CARINA_OPS_RECONCILIATION_ENABLED !== 'true') return;
  if (!config.carinaOps.productEnabled) return;

  const hours = Number(process.env.CARINA_OPS_RECONCILIATION_INTERVAL_HOURS ?? '24');
  const ms = Math.max(hours, 1) * 60 * 60 * 1000;

  const run = async () => {
    try {
      await runBillingReconciliation();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[reconciliation] scheduled run failed: ${msg}`);
    }
  };

  void run();
  intervalHandle = setInterval(() => void run(), ms);
  console.log(`[reconciliation] scheduled every ${hours}h`);
}

export function stopBillingReconciliationSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
