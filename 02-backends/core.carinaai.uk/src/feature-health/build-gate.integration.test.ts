/**
 * Integration-style gate: broken active critical feature blocks new work.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearFeatureRegistry,
  registerFeature,
  checkAllFeatures,
  evaluateBuildGate,
  canBuildNewFeature,
} from './index.js';

describe('feature health build gate integration', () => {
  beforeEach(() => {
    clearFeatureRegistry();
  });

  it('blocks when a registered endpoint breaks with active users', async () => {
    registerFeature('billing', ['/api/billing/checkout'], 'billing', {
      criticalPath: true,
      revenueImpact: 10,
    });
    registerFeature('settings', ['/api/settings'], 'platform');

    await checkAllFeatures({
      fetchFn: async (url) => {
        if (url.includes('checkout')) return { status: 500, ok: false };
        return { status: 200, ok: true };
      },
      getUsage: (name) =>
        name === 'billing'
          ? { activeUsers7d: 25, adoptionRate: 55 }
          : { activeUsers7d: 2, adoptionRate: 10 },
      getErrorRate: () => 0,
    });

    expect(canBuildNewFeature()).toBe(false);
    const gate = evaluateBuildGate();
    expect(gate.blocked).toBe(true);
    expect(gate.blockingIssues[0]?.feature).toBe('billing');
    expect(gate.blockingIssues[0]?.priority).toBe('P0');
    expect(gate.fixQueue[0]?.feature).toBe('billing');
  });
});
