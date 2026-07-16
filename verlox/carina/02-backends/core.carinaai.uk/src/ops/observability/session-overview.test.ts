import { describe, expect, it } from 'vitest';
import { buildSessionOverview } from './session-overview.js';

describe('session-overview', () => {
  it('returns session overview array with summary fields', async () => {
    const sessions = await buildSessionOverview();
    expect(Array.isArray(sessions)).toBe(true);
    for (const session of sessions) {
      expect(['active', 'idle', 'stale']).toContain(session.status);
      expect(session.sessionId).toBeTruthy();
    }
  });
});
