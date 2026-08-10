import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resetCohortActivityStoreCache,
  upsertSignup,
  recordActivityDay,
  toUtcDateString,
} from './activity-store.js';
import {
  buildCohortDashboardFromData,
  calculateWeeklyRetention,
  compareCohorts,
  defineCohorts,
  getDropoffHeatmap,
} from './cohort-engine.js';
import {
  buildDailyDropoffDigest,
  detectUserDisengagement,
  sendReengagementEmail,
} from './dropoff-alert.js';

const PREV_HOME = process.env.CARINA_HOME;

function mondayOfWeekContaining(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toUtcDateString(d);
}

describe('cohort retention dashboard', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cohort-'));
    process.env.CARINA_HOME = tmpHome;
    resetCohortActivityStoreCache();
  });

  afterEach(() => {
    resetCohortActivityStoreCache();
    if (PREV_HOME === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = PREV_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('groups users into weekly cohorts and computes week 1-12 retention for 4 cohorts', () => {
    // Four Mondays
    const weeks = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];
    const signups = weeks.flatMap((start, wi) =>
      [0, 1, 2, 3].map((ui) => ({
        userId: `c${wi}_u${ui}`,
        workspaceId: 'ws1',
        signedUpAt: `${start}T12:00:00.000Z`,
      })),
    );

    const activity = [];
    for (let wi = 0; wi < 4; wi += 1) {
      const start = weeks[wi]!;
      for (let ui = 0; ui < 4; ui += 1) {
        const userId = `c${wi}_u${ui}`;
        // All active week 1
        activity.push({
          userId,
          workspaceId: 'ws1',
          date: start,
          active: true,
        });
        // Cohort 0 keeps everyone through week 4; others drop hard after week 1
        if (wi === 0) {
          for (let w = 1; w < 4; w += 1) {
            const d = new Date(`${start}T00:00:00.000Z`);
            d.setUTCDate(d.getUTCDate() + w * 7);
            activity.push({
              userId,
              workspaceId: 'ws1',
              date: toUtcDateString(d),
              active: true,
            });
          }
        } else if (ui === 0) {
          // one survivor into week 2 only
          const d = new Date(`${start}T00:00:00.000Z`);
          d.setUTCDate(d.getUTCDate() + 7);
          activity.push({
            userId,
            workspaceId: 'ws1',
            date: toUtcDateString(d),
            active: true,
          });
        }
      }
    }

    const cohorts = defineCohorts(signups, 'week');
    expect(cohorts).toHaveLength(4);
    expect(cohorts.every((c) => c.size === 4)).toBe(true);

    const series = cohorts.map((c) => calculateWeeklyRetention(c, activity, 12));
    expect(series[0]!.weeks[0]!.retentionPct).toBe(100);
    expect(series[0]!.weeks[1]!.retentionPct).toBe(100);
    expect(series[1]!.weeks[0]!.retentionPct).toBe(100);
    expect(series[1]!.weeks[1]!.retentionPct).toBe(25);

    const heatmap = getDropoffHeatmap(series);
    expect(heatmap.some((c) => c.tone === 'green')).toBe(true);
    expect(heatmap.some((c) => c.cliff)).toBe(true);

    const snap = buildCohortDashboardFromData(signups, activity, {
      asOfDate: '2026-02-16',
    });
    expect(snap.cohorts).toHaveLength(4);
    expect(snap.lyingGap.totalUsers).toBe(16);
    expect(snap.lyingGap.gap).toBeGreaterThanOrEqual(0);
    expect(snap.weeks).toHaveLength(12);

    const cmp = compareCohorts(cohorts[0]!, cohorts[1]!, activity, 4);
    expect(cmp.weekDeltas[1]!.deltaPctPoints).toBe(75);
  });

  it('queues same-day re-engagement after 3-week streak then 24h silence', () => {
    const ws = 'ws-drop';
    const userId = 'loyal';
    // Three consecutive weeks of activity ending 2 days ago
    const asOf = new Date('2026-03-10T15:00:00.000Z');
    upsertSignup({
      userId,
      workspaceId: ws,
      signedUpAt: '2026-02-01T00:00:00.000Z',
    });
    for (const day of ['2026-02-17', '2026-02-24', '2026-03-03', '2026-03-08']) {
      recordActivityDay({ userId, workspaceId: ws, date: day, active: true });
    }

    const flag = detectUserDisengagement(ws, userId, {
      asOf,
      silenceHours: 24,
      minStreakWeeks: 3,
    });
    expect(flag).not.toBeNull();
    expect(flag!.activeWeeksStreak).toBeGreaterThanOrEqual(3);

    const job = sendReengagementEmail(ws, userId);
    expect(job.status).toBe('queued');

    upsertSignup({
      userId: 'quiet',
      workspaceId: ws,
      signedUpAt: '2026-02-01T00:00:00.000Z',
      reengagementOptOut: true,
    });
    for (const day of ['2026-02-17', '2026-02-24', '2026-03-03', '2026-03-08']) {
      recordActivityDay({ userId: 'quiet', workspaceId: ws, date: day, active: true });
    }
    const skipped = sendReengagementEmail(ws, 'quiet');
    expect(skipped.status).toBe('skipped_opt_out');

    const digest = buildDailyDropoffDigest(ws, asOf);
    expect(digest.newlyDisengaged.length).toBeGreaterThanOrEqual(1);
    expect(digest.generatedAt).toBeTruthy();
  });

  it('labels monday cohort ids consistently', () => {
    expect(mondayOfWeekContaining('2026-01-07')).toBe('2026-01-05');
  });
});
