/**
 * Cohort retention calculation engine.
 * Groups users by signup week; measures week 1-12 retention.
 */

import {
  listWorkspaceActivity,
  listWorkspaceSignups,
  markRetentionComputed,
  toUtcDateString,
  type UserActivityDay,
  type UserSignupRecord,
} from './activity-store.js';

export type CohortPeriod = 'week' | 'month';

export interface CohortDefinition {
  id: string;
  label: string;
  period: CohortPeriod;
  /** Cohort start (UTC Monday for week, 1st for month) */
  startDate: string;
  endDate: string;
  userIds: string[];
  size: number;
}

export interface RetentionPoint {
  weekN: number;
  activeUsers: number;
  retentionPct: number;
}

export interface CohortRetentionSeries {
  cohortId: string;
  label: string;
  size: number;
  weeks: RetentionPoint[];
  cliffs: Array<{ fromWeek: number; toWeek: number; dropPctPoints: number }>;
}

export interface CohortCompareResult {
  cohortA: CohortRetentionSeries;
  cohortB: CohortRetentionSeries;
  weekDeltas: Array<{ weekN: number; deltaPctPoints: number }>;
}

export interface DropoffHeatmapCell {
  cohortId: string;
  label: string;
  weekN: number;
  retentionPct: number;
  tone: 'green' | 'yellow' | 'red' | 'empty';
  cliff: boolean;
}

export interface LyingDashboardGap {
  totalUsers: number;
  activeUsers: number;
  gap: number;
  gapPctOfTotal: number;
  asOfDate: string;
  note: string;
}

export interface CohortDashboardSnapshot {
  computedAt: string;
  cohorts: CohortRetentionSeries[];
  heatmap: DropoffHeatmapCell[];
  lyingGap: LyingDashboardGap;
  weeks: number[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfUtcWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toUtcDateString(d);
}

function weekLabel(start: string): string {
  return `W/${start}`;
}

function monthLabel(start: string): string {
  return start.slice(0, 7);
}

function retentionTone(pct: number | null): DropoffHeatmapCell['tone'] {
  if (pct == null) return 'empty';
  if (pct > 80) return 'green';
  if (pct >= 50) return 'yellow';
  return 'red';
}

export function defineCohorts(
  signups: UserSignupRecord[],
  period: CohortPeriod = 'week',
): CohortDefinition[] {
  const buckets = new Map<string, CohortDefinition>();
  for (const s of signups) {
    const signed = new Date(s.signedUpAt);
    if (Number.isNaN(signed.getTime())) continue;
    const start =
      period === 'week'
        ? toUtcDateString(startOfUtcWeek(signed))
        : toUtcDateString(startOfUtcMonth(signed));
    const end =
      period === 'week'
        ? addDays(start, 6)
        : toUtcDateString(
            new Date(Date.UTC(signed.getUTCFullYear(), signed.getUTCMonth() + 1, 0)),
          );
    const id = `${period}:${start}`;
    const existing = buckets.get(id);
    if (existing) {
      if (!existing.userIds.includes(s.userId)) {
        existing.userIds.push(s.userId);
        existing.size = existing.userIds.length;
      }
    } else {
      buckets.set(id, {
        id,
        label: period === 'week' ? weekLabel(start) : monthLabel(start),
        period,
        startDate: start,
        endDate: end,
        userIds: [s.userId],
        size: 1,
      });
    }
  }
  return [...buckets.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function defineCohort(
  signups: UserSignupRecord[],
  period: CohortPeriod,
  cohortStartDate: string,
): CohortDefinition | null {
  return (
    defineCohorts(signups, period).find((c) => c.startDate === toUtcDateString(cohortStartDate))
    ?? null
  );
}

function activitySet(activity: UserActivityDay[]): Set<string> {
  const set = new Set<string>();
  for (const row of activity) {
    if (row.active) set.add(`${row.userId}|${row.date}`);
  }
  return set;
}

function wasActiveInWindow(
  userId: string,
  windowStart: string,
  windowEnd: string,
  active: Set<string>,
): boolean {
  let cursor = windowStart;
  while (cursor <= windowEnd) {
    if (active.has(`${userId}|${cursor}`)) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
}

/**
 * % of cohort active on calendar day N after cohort start (0 = signup week day 0).
 */
export function calculateRetention(
  cohort: CohortDefinition,
  activity: UserActivityDay[],
  dayN: number,
): number {
  if (cohort.size === 0) return 0;
  const active = activitySet(activity);
  const day = addDays(cohort.startDate, Math.max(0, Math.floor(dayN)));
  let count = 0;
  for (const userId of cohort.userIds) {
    if (active.has(`${userId}|${day}`)) count += 1;
  }
  return Math.round((count / cohort.size) * 1000) / 10;
}

export function calculateWeeklyRetention(
  cohort: CohortDefinition,
  activity: UserActivityDay[],
  throughWeek = 12,
): CohortRetentionSeries {
  const active = activitySet(activity);
  const weeks: RetentionPoint[] = [];
  for (let weekN = 1; weekN <= throughWeek; weekN += 1) {
    const windowStart = addDays(cohort.startDate, (weekN - 1) * 7);
    const windowEnd = addDays(windowStart, 6);
    let activeUsers = 0;
    for (const userId of cohort.userIds) {
      if (wasActiveInWindow(userId, windowStart, windowEnd, active)) activeUsers += 1;
    }
    const retentionPct =
      cohort.size === 0 ? 0 : Math.round((activeUsers / cohort.size) * 1000) / 10;
    weeks.push({ weekN, activeUsers, retentionPct });
  }

  const cliffs: CohortRetentionSeries['cliffs'] = [];
  for (let i = 1; i < weeks.length; i += 1) {
    const prev = weeks[i - 1]!;
    const curr = weeks[i]!;
    const drop = prev.retentionPct - curr.retentionPct;
    if (drop > 20) {
      cliffs.push({ fromWeek: prev.weekN, toWeek: curr.weekN, dropPctPoints: Math.round(drop * 10) / 10 });
    }
  }

  return {
    cohortId: cohort.id,
    label: cohort.label,
    size: cohort.size,
    weeks,
    cliffs,
  };
}

export function compareCohorts(
  cohortA: CohortDefinition,
  cohortB: CohortDefinition,
  activity: UserActivityDay[],
  throughWeek = 12,
): CohortCompareResult {
  const a = calculateWeeklyRetention(cohortA, activity, throughWeek);
  const b = calculateWeeklyRetention(cohortB, activity, throughWeek);
  const weekDeltas = a.weeks.map((wa, i) => ({
    weekN: wa.weekN,
    deltaPctPoints: Math.round((wa.retentionPct - (b.weeks[i]?.retentionPct ?? 0)) * 10) / 10,
  }));
  return { cohortA: a, cohortB: b, weekDeltas };
}

export function getDropoffHeatmap(
  series: CohortRetentionSeries[],
): DropoffHeatmapCell[] {
  const cells: DropoffHeatmapCell[] = [];
  for (const row of series) {
    const cliffWeeks = new Set(row.cliffs.map((c) => c.toWeek));
    for (const w of row.weeks) {
      cells.push({
        cohortId: row.cohortId,
        label: row.label,
        weekN: w.weekN,
        retentionPct: w.retentionPct,
        tone: retentionTone(w.retentionPct),
        cliff: cliffWeeks.has(w.weekN),
      });
    }
  }
  return cells;
}

export function computeLyingDashboardGap(
  signups: UserSignupRecord[],
  activity: UserActivityDay[],
  asOfDate?: string,
): LyingDashboardGap {
  const asOf = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  const totalUsers = new Set(signups.map((s) => s.userId)).size;
  const windowStart = addDays(asOf, -6);
  const active = activitySet(activity);
  const activeUsers = new Set(
    signups
      .map((s) => s.userId)
      .filter((userId) => wasActiveInWindow(userId, windowStart, asOf, active)),
  ).size;
  const gap = Math.max(0, totalUsers - activeUsers);
  const gapPctOfTotal = totalUsers === 0 ? 0 : Math.round((gap / totalUsers) * 1000) / 10;
  return {
    totalUsers,
    activeUsers,
    gap,
    gapPctOfTotal,
    asOfDate: asOf,
    note:
      'Total users can rise while active users fall. Cohorts expose the lie; this gap is the headline truth metric.',
  };
}

export function buildCohortDashboard(
  workspaceId: string,
  opts?: { period?: CohortPeriod; throughWeek?: number; asOfDate?: string },
): CohortDashboardSnapshot {
  const period = opts?.period ?? 'week';
  const throughWeek = opts?.throughWeek ?? 12;
  const signups = listWorkspaceSignups(workspaceId);
  const activity = listWorkspaceActivity(workspaceId);
  const cohorts = defineCohorts(signups, period).map((c) =>
    calculateWeeklyRetention(c, activity, throughWeek),
  );
  const heatmap = getDropoffHeatmap(cohorts);
  const lyingGap = computeLyingDashboardGap(signups, activity, opts?.asOfDate);
  const computedAt = new Date().toISOString();
  markRetentionComputed(computedAt);
  return {
    computedAt,
    cohorts,
    heatmap,
    lyingGap,
    weeks: Array.from({ length: throughWeek }, (_, i) => i + 1),
  };
}

/** Pure helper for tests: build dashboard from in-memory arrays without store. */
export function buildCohortDashboardFromData(
  signups: UserSignupRecord[],
  activity: UserActivityDay[],
  opts?: { period?: CohortPeriod; throughWeek?: number; asOfDate?: string },
): CohortDashboardSnapshot {
  const period = opts?.period ?? 'week';
  const throughWeek = opts?.throughWeek ?? 12;
  const cohorts = defineCohorts(signups, period).map((c) =>
    calculateWeeklyRetention(c, activity, throughWeek),
  );
  return {
    computedAt: new Date().toISOString(),
    cohorts,
    heatmap: getDropoffHeatmap(cohorts),
    lyingGap: computeLyingDashboardGap(signups, activity, opts?.asOfDate),
    weeks: Array.from({ length: throughWeek }, (_, i) => i + 1),
  };
}

export function msPerWeek(): number {
  return WEEK_MS;
}
