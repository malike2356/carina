/**
 * Fix prioritization: severity × users × revenue; deprecation for unused broken.
 */

import { getAllFeatures, type RegisteredFeature } from './feature-registry.js';

export type FixPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type FixQueueItem = {
  feature: string;
  priority: FixPriority;
  status: RegisteredFeature['health']['status'];
  activeUsers7d: number;
  revenueImpact: number;
  criticalPath: boolean;
  score: number;
  action: 'fix' | 'deprecate';
  recommendation: string;
  owner: string;
};

function classify(feature: RegisteredFeature): FixQueueItem | null {
  const { health } = feature;
  const active = health.activeUsers7d > 0;
  const critical = Boolean(feature.criticalPath);
  const revenue = Number(feature.revenueImpact) || 0;

  if (health.status === 'healthy') return null;

  if (health.status === 'broken' && active && critical) {
    const score = 1000 + health.activeUsers7d * 10 + revenue * 100;
    return {
      feature: feature.name,
      priority: 'P0',
      status: health.status,
      activeUsers7d: health.activeUsers7d,
      revenueImpact: revenue,
      criticalPath: critical,
      score,
      action: 'fix',
      recommendation: 'Fix immediately (broken, active users, critical path).',
      owner: feature.owner,
    };
  }

  if (health.status === 'broken' && active) {
    const score = 500 + health.activeUsers7d * 10 + revenue * 50;
    return {
      feature: feature.name,
      priority: 'P1',
      status: health.status,
      activeUsers7d: health.activeUsers7d,
      revenueImpact: revenue,
      criticalPath: critical,
      score,
      action: 'fix',
      recommendation: 'Fix before starting any new feature work.',
      owner: feature.owner,
    };
  }

  if (health.status === 'degraded') {
    const score = 200 + health.activeUsers7d * 5 + revenue * 20;
    return {
      feature: feature.name,
      priority: 'P2',
      status: health.status,
      activeUsers7d: health.activeUsers7d,
      revenueImpact: revenue,
      criticalPath: critical,
      score,
      action: 'fix',
      recommendation: 'Schedule a fix; degraded but not fully broken.',
      owner: feature.owner,
    };
  }

  // Broken + zero adoption → deprecate / kill, do not auto-fix.
  if (health.status === 'broken' && !active) {
    return {
      feature: feature.name,
      priority: 'P3',
      status: health.status,
      activeUsers7d: 0,
      revenueImpact: revenue,
      criticalPath: critical,
      score: 50 + revenue,
      action: 'deprecate',
      recommendation:
        'Broken with zero adoption. Prefer deprecation or kill over a fix ticket.',
      owner: feature.owner,
    };
  }

  return null;
}

export function prioritizeFixes(features?: RegisteredFeature[]): FixQueueItem[] {
  const list = features ?? getAllFeatures();
  const items = list.map(classify).filter((x): x is FixQueueItem => Boolean(x));
  const rank: Record<FixPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return items.sort((a, b) => {
    const pr = rank[a.priority] - rank[b.priority];
    if (pr !== 0) return pr;
    return b.score - a.score;
  });
}

export function generateFixQueue(features?: RegisteredFeature[]): {
  queue: FixQueueItem[];
  fixNow: FixQueueItem[];
  deprecate: FixQueueItem[];
} {
  const queue = prioritizeFixes(features);
  return {
    queue,
    fixNow: queue.filter((i) => i.action === 'fix'),
    deprecate: queue.filter((i) => i.action === 'deprecate'),
  };
}
