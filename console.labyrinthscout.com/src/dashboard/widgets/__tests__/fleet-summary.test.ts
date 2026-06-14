import { describe, expect, it } from 'vitest';
import { buildFleetSummary } from '../fleet-summary.js';

const NOW = new Date('2026-06-07T12:00:00Z').getTime();

describe('buildFleetSummary', () => {
  it('marks an agent with heartbeat within 90s as active', () => {
    const summary = buildFleetSummary([
      { id: 'a', name: 'A', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:59:30Z' },
    ], [], NOW);

    expect(summary.fleet[0]?.status).toBe('active');
    expect(summary.active).toBe(1);
  });

  it('marks an agent with heartbeat older than 90s as offline', () => {
    const summary = buildFleetSummary([
      { id: 'b', name: 'B', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:55:00Z' },
    ], [], NOW);

    expect(summary.fleet[0]?.status).toBe('offline');
    expect(summary.offline).toBe(1);
  });

  it('marks suspended agents regardless of heartbeat age', () => {
    const summary = buildFleetSummary([
      { id: 'c', name: 'C', status: 'suspended', suspension_reason: 'manual', last_heartbeat: '2026-06-07T11:59:50Z' },
    ], [], NOW);

    expect(summary.fleet[0]?.status).toBe('suspended');
    expect(summary.suspended).toBe(1);
    expect(summary.active).toBe(0);
  });

  it('defaults events24h counts to zero when no event rows exist', () => {
    const summary = buildFleetSummary([
      { id: 'a', name: 'A', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:59:30Z' },
    ], [], NOW);

    expect(summary.fleet[0]?.events24h).toEqual({
      critical: 0,
      warning: 0,
      info: 0,
      breach: 0,
    });
  });

  it('aggregates per-instance event counts by severity', () => {
    const summary = buildFleetSummary([
      { id: 'a', name: 'A', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:59:30Z' },
    ], [
      { instance_id: 'a', severity: 'critical', count: '2' },
      { instance_id: 'a', severity: 'warning', count: '3' },
      { instance_id: 'b', severity: 'breach', count: '1' },
    ], NOW);

    expect(summary.fleet[0]?.events24h).toEqual({
      critical: 2,
      warning: 3,
      info: 0,
      breach: 0,
    });
  });

  it('matches total/active/suspended/offline counts to the fleet array', () => {
    const summary = buildFleetSummary([
      { id: 'a', name: 'A', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:59:30Z' },
      { id: 'b', name: 'B', status: 'active', suspension_reason: null, last_heartbeat: '2026-06-07T11:55:00Z' },
      { id: 'c', name: 'C', status: 'suspended', suspension_reason: 'manual', last_heartbeat: '2026-06-07T11:59:50Z' },
    ], [], NOW);

    expect(summary.total).toBe(summary.fleet.length);
    expect(summary.active).toBe(summary.fleet.filter((a) => a.status === 'active').length);
    expect(summary.suspended).toBe(summary.fleet.filter((a) => a.status === 'suspended').length);
    expect(summary.offline).toBe(summary.fleet.filter((a) => a.status === 'offline').length);
  });
});
