import { describe, expect, it } from 'vitest';
import { ProviderHealthTracker } from './provider-health-state.js';

describe('provider health state machine', () => {
  it('moves through degraded and unavailable, then recovers', () => {
    const tracker = new ProviderHealthTracker();
    expect(tracker.observe({ healthy: false })).toBe('degraded');
    expect(tracker.observe({ healthy: false })).toBe('unavailable');
    expect(tracker.observe({ healthy: true, latencyMs: 20 })).toBe('healthy');
  });

  it('marks slow but reachable providers degraded', () => {
    const tracker = new ProviderHealthTracker();
    tracker.observe({ healthy: true, latencyMs: 10 });
    expect(tracker.observe({ healthy: true, latencyMs: 2000 })).toBe('degraded');
  });
});
