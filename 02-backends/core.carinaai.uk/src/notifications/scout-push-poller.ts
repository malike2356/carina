import { pollScoutAlertsForAllTenants } from './mobile-push.js';

const POLL_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startScoutPushPoller(): void {
  if (timer) return;
  const run = () => {
    void pollScoutAlertsForAllTenants().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[mobile-push] scout poll failed:', msg);
    });
  };
  run();
  timer = setInterval(run, POLL_MS);
}

export function stopScoutPushPoller(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
