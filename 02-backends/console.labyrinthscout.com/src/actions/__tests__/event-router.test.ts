import { describe, it, expect } from 'vitest';
import { findPlaybook } from '../playbook-registry.js';

describe('event-router playbooks', () => {
  it('anomaly_detected critical routes to human playbook', () => {
    const p = findPlaybook('anomaly_detected', 'critical');
    expect(p?.category).toBe('human');
    expect(p?.id).toBe('anomaly-critical-playbook');
  });

  it('alert_test routes to monitor playbook', () => {
    const p = findPlaybook('alert_test', 'info');
    expect(p?.category).toBe('monitor');
  });

  it('breach_detected routes to human playbook', () => {
    const p = findPlaybook('breach_detected', 'breach');
    expect(p?.category).toBe('human');
  });

  it('unknown event type returns null', () => {
    const p = findPlaybook('made_up_event', 'info');
    expect(p).toBeNull();
  });
});
