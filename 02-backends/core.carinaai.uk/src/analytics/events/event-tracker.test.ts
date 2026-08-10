import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertNoPiiInProperties,
  trackEvent,
  flushEventsNow,
  resetEventBusForTests,
  resetEventStoreCache,
  getFeatureAdoption,
  getUnusedFeatures,
  getUserJourney,
  getActiveStreak,
  getActiveUserMetrics,
  isUserActive,
  REGISTERED_FEATURES,
} from './index.js';
import { resetCohortActivityStoreCache } from '../cohort/activity-store.js';

const PREV_HOME = process.env.CARINA_HOME;

describe('feature adoption event tracking', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-events-'));
    process.env.CARINA_HOME = tmpHome;
    resetEventBusForTests();
    resetEventStoreCache();
    resetCohortActivityStoreCache();
  });

  afterEach(() => {
    resetEventBusForTests();
    resetEventStoreCache();
    resetCohortActivityStoreCache();
    if (PREV_HOME === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = PREV_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('rejects PII in event properties', () => {
    expect(assertNoPiiInProperties({ email: 'a@b.co' }).ok).toBe(false);
    expect(assertNoPiiInProperties({ note: 'hello' }).ok).toBe(true);
    const tracked = trackEvent({
      workspaceId: 'ws',
      userId: 'u1',
      eventName: 'feature_use',
      properties: { email: 'x@y.z' },
    });
    expect(tracked.ok).toBe(false);
  });

  it('buffers events and batch-flushes; dedupes retries within 1s', async () => {
    const ws = 'ws-batch';
    const ts = '2026-04-01T12:00:00.000Z';
    for (let i = 0; i < 3; i += 1) {
      trackEvent({
        workspaceId: ws,
        userId: 'u1',
        eventName: 'page_view',
        timestamp: ts,
        properties: { path: '/analytics' },
      });
    }
    const written = await flushEventsNow();
    expect(written).toBe(1);
  });

  it('fires 1000 events across 10 users and reports adoption, streaks, metrics', async () => {
    const ws = 'ws-load';
    let i = 0;
    while (i < 1000) {
      const userId = `user_${i % 10}`;
      const features = ['outreach', 'analytics', 'pipeline', 'settings'] as const;
      const feature = features[i % features.length]!;
      const useFeature = feature === 'settings' && i % 10 > 1 ? 'outreach' : feature;
      const dayOffset = Math.floor(i / 50);
      const day = new Date(Date.UTC(2026, 3, 1 + (dayOffset % 14)));
      trackEvent({
        workspaceId: ws,
        userId,
        eventName: 'feature_use',
        timestamp: day.toISOString(),
        properties: { feature: useFeature, action: 'use', n: i },
      });
      i += 1;
    }
    await flushEventsNow();

    const from = '2026-04-01T00:00:00.000Z';
    const to = '2026-04-20T23:59:59.999Z';
    const outreach = getFeatureAdoption(ws, 'outreach', { from, to });
    expect(outreach.activeUsers).toBeGreaterThanOrEqual(10);
    expect(outreach.adoptionPct).toBeGreaterThan(0);

    const unused = getUnusedFeatures(ws, { from, to }, 50);
    expect(Array.isArray(unused)).toBe(true);
    expect(REGISTERED_FEATURES.length).toBeGreaterThanOrEqual(8);

    const journey = getUserJourney(ws, 'user_0', { from, to });
    expect(journey.length).toBeGreaterThan(0);

    expect(isUserActive(ws, 'user_0', '2026-04-01')).toBe(true);
    const streak = getActiveStreak(ws, 'user_0', '2026-04-14');
    expect(streak).toBeGreaterThanOrEqual(0);

    const metrics = getActiveUserMetrics(ws, '2026-04-10');
    expect(metrics.dau + metrics.wau + metrics.mau).toBeGreaterThan(0);
    expect(metrics.elapsedMs).toBeLessThan(500);

    // monthly partition file exists
    const monthFile = path.join(tmpHome, 'analytics', 'events', 'events-2026-04.json');
    expect(fs.existsSync(monthFile)).toBe(true);
  });
});
