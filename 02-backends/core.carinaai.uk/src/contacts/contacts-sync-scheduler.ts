import { Cron } from 'croner';
import { sweepDueContactsSyncSchedules } from './contacts-sync-runner.js';

let syncCron: Cron | null = null;

/** Sweep every 15 minutes; each workspace runs based on timesPerDay vs last_run_at. */
export function startContactsSyncScheduler(): void {
  if (syncCron) return;
  syncCron = new Cron('*/15 * * * *', () => {
    void sweepDueContactsSyncSchedules()
      .then((summary) => {
        if (summary.ran > 0) {
          console.log(
            `[contacts-sync] sweep ran=${summary.ran} checked=${summary.checked} failures=${summary.failures}`,
          );
        }
      })
      .catch((err) => {
        console.warn('[contacts-sync] schedule sweep failed:', err);
      });
  });
  // Seed defaults shortly after boot without blocking startup.
  setTimeout(() => {
    void sweepDueContactsSyncSchedules().catch((err) => {
      console.warn('[contacts-sync] initial sweep failed:', err);
    });
  }, 45_000);
}

export function stopContactsSyncScheduler(): void {
  syncCron?.stop();
  syncCron = null;
}
