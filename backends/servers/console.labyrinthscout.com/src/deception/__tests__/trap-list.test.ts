import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../security/honeypot-manager.js', () => ({
  honeypotManager: {
    listRecentHoneypots: vi.fn().mockResolvedValue([
      {
        id: 'hp-1',
        type: 'token',
        name: 'Canary token',
        value: 'tkn_decoy_example',
        description: null,
        instanceId: 'inst-1',
        triggered: true,
        triggeredAt: new Date('2026-06-22T10:00:00Z'),
        triggerIp: '10.0.0.1',
        triggerMetadata: {},
        retiredAt: null,
        createdAt: new Date('2026-06-21T10:00:00Z'),
      },
    ]),
  },
}));

vi.mock('../moving-target.js', () => ({
  movingTarget: {
    getCurrentMarker: vi.fn().mockReturnValue({
      value: 'MARKER-ABC123',
      rotatedAt: new Date('2026-06-22T12:00:00Z'),
    }),
    getPreviousMarkers: vi.fn().mockReturnValue([]),
  },
}));

import { listDeceptionTraps } from '../trap-list.js';

describe('listDeceptionTraps', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns honeypots and the current moving-target marker', async () => {
    const traps = await listDeceptionTraps({ limit: 10 });
    expect(traps.length).toBeGreaterThanOrEqual(2);
    expect(traps[0]?.type).toBe('moving_target_marker');
    expect(traps.some((trap) => trap.type === 'canary_token' && trap.triggered)).toBe(true);
  });
});
