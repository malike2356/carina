/**
 * Hermetic feature-health audit tests.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearFeatureRegistry,
  registerFeature,
  checkAllFeatures,
  generateFixQueue,
  evaluateBuildGate,
  canBuildNewFeature,
  trafficLight,
} from './index.js';

describe('feature health audit', () => {
  beforeEach(() => {
    clearFeatureRegistry();
  });

  it('registers features and runs smoke checks', async () => {
    registerFeature('billing', ['/api/health'], 'payments', { criticalPath: true, revenueImpact: 10 });
    registerFeature('settings', ['/api/settings/ok'], 'platform');

    const report = await checkAllFeatures({
      fetchFn: async (url) => {
        if (url.includes('/api/health')) return { status: 200, ok: true };
        return { status: 500, ok: false };
      },
      getErrorRate: () => 0,
      getUsage: (name) =>
        name === 'billing'
          ? { activeUsers7d: 12, adoptionRate: 40 }
          : { activeUsers7d: 0, adoptionRate: 0 },
    });

    expect(report.summary.healthy).toBe(1);
    expect(report.summary.broken).toBe(1);
    expect(trafficLight('broken')).toBe('red');
  });

  it('prioritizes P0 > P1 > P2 > P3 and recommends deprecate for unused broken', async () => {
    registerFeature('pay', ['/pay'], 'payments', { criticalPath: true, revenueImpact: 5 });
    registerFeature('crm', ['/crm'], 'growth');
    registerFeature('legacy', ['/legacy'], 'ops');
    registerFeature('slow', ['/slow'], 'platform');

    await checkAllFeatures({
      fetchFn: async (url) => {
        if (url.includes('/slow')) return { status: 200, ok: true };
        return { status: 503, ok: false };
      },
      getErrorRate: (name) => (name === 'slow' ? 0.02 : 0),
      getUsage: (name) => {
        if (name === 'pay' || name === 'crm') return { activeUsers7d: 5, adoptionRate: 20 };
        return { activeUsers7d: 0, adoptionRate: 0 };
      },
    });

    const { queue, deprecate } = generateFixQueue();
    expect(queue.map((i) => i.priority)).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(queue[0]?.feature).toBe('pay');
    expect(deprecate.some((d) => d.feature === 'legacy')).toBe(true);
    expect(deprecate[0]?.action).toBe('deprecate');
  });

  it('blocks new feature work when P0/P1 exist', async () => {
    registerFeature('auth', ['/auth'], 'security', { criticalPath: true });
    await checkAllFeatures({
      fetchFn: async () => ({ status: 500, ok: false }),
      getUsage: () => ({ activeUsers7d: 3, adoptionRate: 10 }),
    });
    expect(canBuildNewFeature()).toBe(false);
    const gate = evaluateBuildGate();
    expect(gate.blocked).toBe(true);
    expect(gate.blockingIssues.length).toBeGreaterThan(0);
    expect(gate.fixQueue[0]?.feature).toBe('auth');
  });

  it('allows build when only P3 deprecations remain', async () => {
    registerFeature('dead', ['/dead'], 'ops');
    await checkAllFeatures({
      fetchFn: async () => ({ status: 404, ok: false }),
      getUsage: () => ({ activeUsers7d: 0, adoptionRate: 0 }),
    });
    expect(canBuildNewFeature()).toBe(true);
    const gate = evaluateBuildGate();
    expect(gate.allowed).toBe(true);
    expect(gate.deprecate[0]?.feature).toBe('dead');
  });
});
