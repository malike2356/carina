/**
 * Feature adoption analytics over tracked events.
 */

import { REGISTERED_FEATURES, type AnalyticsEvent } from './event-schema.js';
import { listEventsInRange } from './event-store.js';

export type DateRange = { from: string; to: string };

function featureFromEvent(evt: AnalyticsEvent): string | null {
  if (evt.eventName === 'feature_use') {
    const f = evt.properties.feature;
    return typeof f === 'string' ? f : null;
  }
  if (evt.eventName === 'page_view') {
    const path = evt.properties.path;
    if (typeof path !== 'string') return null;
    if (path.includes('/outreach')) return 'outreach';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/approvals')) return 'approvals';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/workers')) return 'workers';
    return 'page';
  }
  return null;
}

export function getFeatureAdoption(
  workspaceId: string,
  featureName: string,
  dateRange: DateRange,
): { feature: string; activeUsers: number; usersWhoUsed: number; adoptionPct: number } {
  const events = listEventsInRange({
    workspaceId,
    from: dateRange.from,
    to: dateRange.to,
  });
  const activeUsers = new Set(events.map((e) => e.userId));
  const usersWhoUsed = new Set(
    events
      .filter((e) => featureFromEvent(e) === featureName)
      .map((e) => e.userId),
  );
  const active = activeUsers.size;
  const used = usersWhoUsed.size;
  return {
    feature: featureName,
    activeUsers: active,
    usersWhoUsed: used,
    adoptionPct: active === 0 ? 0 : Math.round((used / active) * 1000) / 10,
  };
}

export function getFeatureFrequency(
  workspaceId: string,
  featureName: string,
  dateRange: DateRange,
): { feature: string; uses: number; uniqueUsers: number; avgUsesPerUserPerWeek: number } {
  const events = listEventsInRange({
    workspaceId,
    from: dateRange.from,
    to: dateRange.to,
  }).filter((e) => featureFromEvent(e) === featureName);
  const users = new Set(events.map((e) => e.userId));
  const fromMs = Date.parse(dateRange.from);
  const toMs = Date.parse(dateRange.to);
  const weeks = Math.max(1, (toMs - fromMs) / (7 * 86_400_000));
  const uses = events.length;
  const uniqueUsers = users.size || 1;
  return {
    feature: featureName,
    uses,
    uniqueUsers: users.size,
    avgUsesPerUserPerWeek: Math.round((uses / uniqueUsers / weeks) * 100) / 100,
  };
}

export function getUnusedFeatures(
  workspaceId: string,
  dateRange: DateRange,
  thresholdPct = 20,
  catalog: readonly string[] = REGISTERED_FEATURES,
): Array<{ feature: string; adoptionPct: number }> {
  return catalog
    .map((feature) => getFeatureAdoption(workspaceId, feature, dateRange))
    .filter((row) => row.adoptionPct < thresholdPct)
    .map((row) => ({ feature: row.feature, adoptionPct: row.adoptionPct }))
    .sort((a, b) => a.adoptionPct - b.adoptionPct);
}

export function getUserJourney(
  workspaceId: string,
  userId: string,
  dateRange?: DateRange,
): AnalyticsEvent[] {
  const from = dateRange?.from ?? '1970-01-01T00:00:00.000Z';
  const to = dateRange?.to ?? new Date().toISOString();
  return listEventsInRange({ workspaceId, userId, from, to });
}

export function getFeatureCorrelation(
  workspaceId: string,
  dateRange: DateRange,
): Array<{ featureA: string; featureB: string; usersTogether: number; liftHint: number }> {
  const events = listEventsInRange({
    workspaceId,
    from: dateRange.from,
    to: dateRange.to,
  });
  const byUser = new Map<string, Set<string>>();
  for (const evt of events) {
    const feature = featureFromEvent(evt);
    if (!feature) continue;
    const set = byUser.get(evt.userId) ?? new Set();
    set.add(feature);
    byUser.set(evt.userId, set);
  }
  const pairCounts = new Map<string, number>();
  const featureCounts = new Map<string, number>();
  for (const features of byUser.values()) {
    const list = [...features].sort();
    for (const f of list) featureCounts.set(f, (featureCounts.get(f) || 0) + 1);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = `${list[i]}||${list[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }
  const totalUsers = byUser.size || 1;
  return [...pairCounts.entries()]
    .map(([key, usersTogether]) => {
      const [featureA, featureB] = key.split('||') as [string, string];
      const pa = (featureCounts.get(featureA) || 0) / totalUsers;
      const pb = (featureCounts.get(featureB) || 0) / totalUsers;
      const pab = usersTogether / totalUsers;
      const liftHint = pa * pb === 0 ? 0 : Math.round((pab / (pa * pb)) * 100) / 100;
      return { featureA, featureB, usersTogether, liftHint };
    })
    .sort((a, b) => b.usersTogether - a.usersTogether)
    .slice(0, 50);
}

export function getAdoptionSummary(workspaceId: string, dateRange: DateRange) {
  const features = REGISTERED_FEATURES.map((feature) =>
    getFeatureAdoption(workspaceId, feature, dateRange),
  );
  return {
    dateRange,
    features,
    unused: getUnusedFeatures(workspaceId, dateRange),
    correlations: getFeatureCorrelation(workspaceId, dateRange).slice(0, 10),
  };
}
