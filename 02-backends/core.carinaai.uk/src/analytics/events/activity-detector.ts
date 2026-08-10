/**
 * Active-user classification from product events (feeds cohort + drop-off).
 */

import { listEventsInRange } from './event-store.js';
import { toUtcDateString } from '../cohort/activity-store.js';
import {
  detectUserDisengagement,
  sendReengagementEmail,
  type DisengagementFlag,
} from '../cohort/dropoff-alert.js';

export function isUserActive(
  workspaceId: string,
  userId: string,
  date: string,
): boolean {
  const day = toUtcDateString(date);
  const from = `${day}T00:00:00.000Z`;
  const to = `${day}T23:59:59.999Z`;
  const events = listEventsInRange({ workspaceId, userId, from, to });
  return events.length > 0;
}

export function getActiveStreak(
  workspaceId: string,
  userId: string,
  asOfDate?: string,
): number {
  const asOf = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  let streak = 0;
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(`${asOf}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const day = toUtcDateString(d);
    if (!isUserActive(workspaceId, userId, day)) break;
    streak += 1;
  }
  return streak;
}

/**
 * Silence after 3+ consecutive active weeks + 24h quiet.
 * Designed to be runnable hourly; fires within ~1h of the silence threshold when cron'd.
 */
export function detectSilence(
  workspaceId: string,
  userId: string,
  opts?: { asOf?: Date },
): DisengagementFlag | null {
  return detectUserDisengagement(workspaceId, userId, {
    asOf: opts?.asOf ?? new Date(),
    silenceHours: 24,
    minStreakWeeks: 3,
  });
}

export function getDAU(workspaceId: string, asOfDate?: string): number {
  const day = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  const from = `${day}T00:00:00.000Z`;
  const to = `${day}T23:59:59.999Z`;
  return new Set(listEventsInRange({ workspaceId, from, to }).map((e) => e.userId)).size;
}

export function getWAU(workspaceId: string, asOfDate?: string): number {
  const day = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  const end = new Date(`${day}T23:59:59.999Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  return new Set(
    listEventsInRange({
      workspaceId,
      from: start.toISOString(),
      to: end.toISOString(),
    }).map((e) => e.userId),
  ).size;
}

export function getMAU(workspaceId: string, asOfDate?: string): number {
  const day = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  const end = new Date(`${day}T23:59:59.999Z`);
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return new Set(
    listEventsInRange({
      workspaceId,
      from: start.toISOString(),
      to: end.toISOString(),
    }).map((e) => e.userId),
  ).size;
}

export function getActiveUserMetrics(workspaceId: string, asOfDate?: string) {
  const started = Date.now();
  const dau = getDAU(workspaceId, asOfDate);
  const wau = getWAU(workspaceId, asOfDate);
  const mau = getMAU(workspaceId, asOfDate);
  const elapsedMs = Date.now() - started;
  return { dau, wau, mau, asOfDate: asOfDate ?? toUtcDateString(new Date()), elapsedMs };
}

export function fireSilenceReengagement(
  workspaceId: string,
  userId: string,
  opts?: { asOf?: Date },
) {
  const flag = detectSilence(workspaceId, userId, opts);
  if (!flag) return { flag: null, job: null };
  const job = sendReengagementEmail(workspaceId, userId);
  return { flag, job };
}
