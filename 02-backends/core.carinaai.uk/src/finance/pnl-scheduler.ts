/**
 * Monthly P&L cron: generate previous calendar month automatically.
 */

import { generateMonthlyPnL } from './pnl-generator.js';
import { buildLiabilityAlert } from './liability-detector.js';
import { mutateFinanceStore } from './finance-store.js';

let timer: ReturnType<typeof setInterval> | null = null;
let lastAlert: ReturnType<typeof buildLiabilityAlert> = null;

export function getLastLiabilityAlert() {
  return lastAlert;
}

export async function runMonthlyPnLJob(now = new Date()): Promise<{
  year: number;
  month: number;
  alert: ReturnType<typeof buildLiabilityAlert>;
}> {
  // Generate for previous complete month by default
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;
  await generateMonthlyPnL(year, month, { refresh: true });
  const alert = buildLiabilityAlert(year, month);
  lastAlert = alert;
  mutateFinanceStore((s) => {
    s.lastMonthlyRunAt = now.toISOString();
  });
  if (alert) {
    console.warn(`[finance-pnl] ${alert.level}: ${alert.message}`);
  }
  return { year, month, alert };
}

/** Check hourly whether we should run the monthly job (1st UTC day). */
export function startMonthlyPnLScheduler(): void {
  if (timer) return;
  const tick = () => {
    const now = new Date();
    if (now.getUTCDate() !== 1) return;
    if (now.getUTCHours() !== 3) return; // 03:00 UTC on the 1st
    void runMonthlyPnLJob(now).catch((err) => {
      console.error('[finance-pnl] monthly job failed', err);
    });
  };
  timer = setInterval(tick, 60 * 60 * 1000);
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as NodeJS.Timeout).unref?.();
  }
}

export function stopMonthlyPnLScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
