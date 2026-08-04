import { isScoutAgenticLayerEnabled } from './scout-agentic-guard.js';
import { runProactiveAdvisor } from './proactive-advisor.js';

let dailyTimer: ReturnType<typeof setTimeout> | null = null;
let dailyInterval: ReturnType<typeof setInterval> | null = null;

export function startScoutAgenticSchedulers(): void {
  if (!isScoutAgenticLayerEnabled()) return;
  if (dailyTimer || dailyInterval) return;

  const hour = parseInt(process.env.SCOUT_PROACTIVE_ADVISOR_HOUR_UTC ?? '6', 10);
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  dailyTimer = setTimeout(() => {
    void runProactiveAdvisor().catch(() => undefined);
    dailyInterval = setInterval(() => {
      void runProactiveAdvisor().catch(() => undefined);
    }, 24 * 60 * 60 * 1000);
    dailyInterval.unref?.();
  }, next.getTime() - now.getTime());
  dailyTimer.unref?.();

  console.log('[scout-agentic] Proactive advisor scheduled (daily UTC)');
}

export function stopScoutAgenticSchedulers(): void {
  if (dailyTimer) clearTimeout(dailyTimer);
  if (dailyInterval) clearInterval(dailyInterval);
  dailyTimer = null;
  dailyInterval = null;
}
