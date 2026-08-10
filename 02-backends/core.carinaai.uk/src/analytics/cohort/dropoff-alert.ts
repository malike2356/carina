/**
 * Drop-off / disengagement detection and re-engagement queue.
 * Same-day alerts; re-engagement respects communication opt-out.
 */

import {
  appendReengagementJob,
  listReengagementJobs,
  listWorkspaceActivity,
  listWorkspaceSignups,
  loadCohortActivityStore,
  mutateCohortActivityStore,
  toUtcDateString,
  type ReengagementJob,
  type UserActivityDay,
  type UserSignupRecord,
} from './activity-store.js';
import {
  calculateWeeklyRetention,
  defineCohorts,
  type CohortDefinition,
  type CohortRetentionSeries,
} from './cohort-engine.js';

export interface DisengagementFlag {
  userId: string;
  workspaceId: string;
  detectedAt: string;
  activeWeeksStreak: number;
  silentHours: number;
  reason: string;
}

export interface CohortAnomalyAlert {
  cohortId: string;
  label: string;
  weekN: number;
  cohortRetentionPct: number;
  baselinePct: number;
  deviationPctPoints: number;
  detectedAt: string;
}

export interface DailyDropoffDigest {
  workspaceId: string;
  generatedAt: string;
  newlyDisengaged: DisengagementFlag[];
  anomalies: CohortAnomalyAlert[];
  reengagementQueued: number;
  reengagementSkippedOptOut: number;
}

function datesDescending(activity: UserActivityDay[], userId: string): string[] {
  return activity
    .filter((a) => a.userId === userId && a.active)
    .map((a) => a.date)
    .sort((a, b) => b.localeCompare(a));
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

/** Count consecutive calendar weeks (Mon-Sun) with any activity, ending at last active day. */
export function getActiveWeekStreak(
  activity: UserActivityDay[],
  userId: string,
  asOfDate?: string,
): number {
  const asOf = asOfDate ? toUtcDateString(asOfDate) : toUtcDateString(new Date());
  const days = uniqueSortedDates(
    activity.filter((a) => a.userId === userId && a.active && a.date <= asOf).map((a) => a.date),
  );
  if (days.length === 0) return 0;

  // Walk weeks backward from asOf week
  const asOfMs = Date.parse(`${asOf}T00:00:00.000Z`);
  let streak = 0;
  for (let w = 0; w < 52; w += 1) {
    const weekEndMs = asOfMs - w * 7 * 86_400_000;
    const weekStartMs = weekEndMs - 6 * 86_400_000;
    const weekStart = toUtcDateString(new Date(weekStartMs));
    const weekEnd = toUtcDateString(new Date(weekEndMs));
    const hit = days.some((d) => d >= weekStart && d <= weekEnd);
    if (!hit) break;
    streak += 1;
  }
  return streak;
}

export function detectUserDisengagement(
  workspaceId: string,
  userId: string,
  opts?: { asOf?: Date; silenceHours?: number; minStreakWeeks?: number },
): DisengagementFlag | null {
  const asOf = opts?.asOf ?? new Date();
  const silenceHours = opts?.silenceHours ?? 24;
  const minStreak = opts?.minStreakWeeks ?? 3;
  const activity = listWorkspaceActivity(workspaceId);
  const streak = getActiveWeekStreak(activity, userId, toUtcDateString(asOf));
  if (streak < minStreak) return null;

  const lastActive = datesDescending(activity, userId)[0];
  if (!lastActive) return null;
  const lastMs = Date.parse(`${lastActive}T00:00:00.000Z`);
  const silentHours = Math.max(0, (asOf.getTime() - lastMs) / 3_600_000);
  if (silentHours < silenceHours) return null;

  return {
    userId,
    workspaceId,
    detectedAt: asOf.toISOString(),
    activeWeeksStreak: streak,
    silentHours: Math.round(silentHours * 10) / 10,
    reason: `Active ${streak} consecutive weeks then silent ${Math.round(silentHours)}h`,
  };
}

export function detectWorkspaceDisengagement(
  workspaceId: string,
  opts?: { asOf?: Date; silenceHours?: number; minStreakWeeks?: number },
): DisengagementFlag[] {
  const signups = listWorkspaceSignups(workspaceId);
  const flags: DisengagementFlag[] = [];
  for (const s of signups) {
    const flag = detectUserDisengagement(workspaceId, s.userId, opts);
    if (flag) flags.push(flag);
  }
  return flags;
}

/**
 * Queue a re-engagement email. Respects opt-out. Does not send raw PII email bodies here;
 * Soft Wall / mailer integration can pick up queued jobs.
 */
export function sendReengagementEmail(
  workspaceId: string,
  userId: string,
  signup?: UserSignupRecord,
): ReengagementJob {
  const record =
    signup
    ?? listWorkspaceSignups(workspaceId).find((s) => s.userId === userId);
  const id = `re_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  if (record?.reengagementOptOut) {
    return appendReengagementJob({
      id,
      workspaceId,
      userId,
      createdAt: new Date().toISOString(),
      status: 'skipped_opt_out',
      reason: 'User opted out of re-engagement',
    });
  }
  return appendReengagementJob({
    id,
    workspaceId,
    userId,
    createdAt: new Date().toISOString(),
    status: 'queued',
    reason: 'Disengagement after 3+ week streak; same-day re-engagement',
  });
}

export function cohortAnomalyAlert(
  cohort: CohortDefinition,
  allSeries: CohortRetentionSeries[],
  weekN: number,
  thresholdPctPoints = 15,
): CohortAnomalyAlert | null {
  const target = allSeries.find((s) => s.cohortId === cohort.id);
  const point = target?.weeks.find((w) => w.weekN === weekN);
  if (!point) return null;

  const peers = allSeries
    .filter((s) => s.cohortId !== cohort.id)
    .map((s) => s.weeks.find((w) => w.weekN === weekN)?.retentionPct)
    .filter((v): v is number => typeof v === 'number');
  if (peers.length === 0) return null;

  const baselinePct =
    Math.round((peers.reduce((a, b) => a + b, 0) / peers.length) * 10) / 10;
  const deviationPctPoints = Math.round((point.retentionPct - baselinePct) * 10) / 10;
  if (Math.abs(deviationPctPoints) <= thresholdPctPoints) return null;

  return {
    cohortId: cohort.id,
    label: cohort.label,
    weekN,
    cohortRetentionPct: point.retentionPct,
    baselinePct,
    deviationPctPoints,
    detectedAt: new Date().toISOString(),
  };
}

export function detectCohortAnomalies(
  workspaceId: string,
  opts?: { throughWeek?: number; thresholdPctPoints?: number },
): CohortAnomalyAlert[] {
  const throughWeek = opts?.throughWeek ?? 12;
  const threshold = opts?.thresholdPctPoints ?? 15;
  const signups = listWorkspaceSignups(workspaceId);
  const activity = listWorkspaceActivity(workspaceId);
  const defs = defineCohorts(signups, 'week');
  const series = defs.map((c) => calculateWeeklyRetention(c, activity, throughWeek));
  const alerts: CohortAnomalyAlert[] = [];
  for (const def of defs) {
    for (let weekN = 1; weekN <= throughWeek; weekN += 1) {
      const alert = cohortAnomalyAlert(def, series, weekN, threshold);
      if (alert) alerts.push(alert);
    }
  }
  return alerts;
}

/** Same-day digest: newly disengaged users + cohort anomalies; queue re-engagement. */
export function buildDailyDropoffDigest(workspaceId: string, asOf = new Date()): DailyDropoffDigest {
  const newlyDisengaged = detectWorkspaceDisengagement(workspaceId, { asOf });
  const anomalies = detectCohortAnomalies(workspaceId);
  let queued = 0;
  let skipped = 0;
  for (const flag of newlyDisengaged) {
    const existing = listReengagementJobs(workspaceId).find(
      (j) =>
        j.userId === flag.userId
        && j.createdAt.slice(0, 10) === toUtcDateString(asOf)
        && (j.status === 'queued' || j.status === 'sent_simulated'),
    );
    if (existing) continue;
    const job = sendReengagementEmail(workspaceId, flag.userId);
    if (job.status === 'skipped_opt_out') skipped += 1;
    else queued += 1;
  }
  mutateCohortActivityStore((store) => {
    store.lastDigestAt = asOf.toISOString();
  });
  return {
    workspaceId,
    generatedAt: asOf.toISOString(),
    newlyDisengaged,
    anomalies,
    reengagementQueued: queued,
    reengagementSkippedOptOut: skipped,
  };
}

export function getLastDigestAt(): string | undefined {
  return loadCohortActivityStore().lastDigestAt;
}
