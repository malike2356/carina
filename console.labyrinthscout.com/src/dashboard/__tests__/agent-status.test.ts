import { describe, expect, it } from 'vitest';
import { buildAgentStatus } from '../widgets/agent-status.js';

describe('buildAgentStatus', () => {
  it('summarises active, offline, and suspended agents', () => {
    const now = new Date('2026-06-07T12:00:00Z').getTime();
    const summary = buildAgentStatus([
      { id: 'a', name: 'A', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:59:30Z' },
      { id: 'b', name: 'B', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:55:00Z' },
      { id: 'c', name: 'C', status: 'suspended', suspension_reason: 'manual', last_heartbeat: '2026-06-07T11:59:50Z' },
    ], now);

    expect(summary.total).toBe(3);
    expect(summary.active).toBe(1);
    expect(summary.offline).toBe(1);
    expect(summary.suspended).toBe(1);
  });
});
