/**
 * Weekly collection schedule helper (invoke from product cron).
 */
import { collectFromPrimaryPlatforms } from './collector.js';
import type { TestimonialStore } from './store.js';

export const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

export type ScheduleState = {
  lastRunAt: string | null;
  nextDueAt: string | null;
};

let lastRunAt: string | null = null;

export function scheduleStatus(now = Date.now()): ScheduleState {
  return {
    lastRunAt,
    nextDueAt: lastRunAt
      ? new Date(Date.parse(lastRunAt) + WEEKLY_MS).toISOString()
      : new Date(now).toISOString(),
  };
}

export function isWeeklyDue(now = Date.now()): boolean {
  if (!lastRunAt) return true;
  return now - Date.parse(lastRunAt) >= WEEKLY_MS;
}

export async function runWeeklyCollection(
  store: TestimonialStore,
  config: {
    twitterUsername?: string;
    linkedinCompany?: string;
    githubRepo?: string;
    product?: string;
    fixturesPath?: string;
    force?: boolean;
  } = {},
): Promise<{ ran: boolean; results: Awaited<ReturnType<typeof collectFromPrimaryPlatforms>> }> {
  if (!config.force && !isWeeklyDue()) {
    return { ran: false, results: [] };
  }
  const results = await collectFromPrimaryPlatforms(store, config);
  lastRunAt = new Date().toISOString();
  return { ran: true, results };
}

export function resetScheduleForTests(): void {
  lastRunAt = null;
}
