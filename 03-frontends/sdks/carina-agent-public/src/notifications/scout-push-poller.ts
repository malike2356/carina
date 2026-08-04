import { pollScoutAlertsForAllTenants } from './mobile-push.js';

const POLL_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startScoutPushPoller(): void {
  if (timer) return;
  void pollScoutAlertsForAllTenants();
  timer = setInterval(() => {
    void pollScoutAlertsForAllTenants();
  }, POLL_MS);
}

export function stopScoutPushPoller(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
