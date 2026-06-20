import { describe, expect, it } from 'vitest';
import { buildChannelHealthSnapshot } from './channel-health.js';

describe('channel-health snapshot', () => {
  it('summarizes channel states', () => {
    const snapshot = buildChannelHealthSnapshot();
    expect(snapshot.channels.length).toBeGreaterThan(0);
    expect(snapshot.summary.total).toBe(snapshot.channels.length);
    expect(snapshot.policies).toHaveProperty('threadOwnership');
  });
});
