import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeRiskScore,
  confidenceBand,
  decideActions,
  severityLevelFromScore,
} from './scorer.js';

describe('warden scorer', () => {
  it('maps bounded severity and confidence bands', () => {
    assert.equal(severityLevelFromScore(3), 'low');
    assert.equal(severityLevelFromScore(4), 'medium');
    assert.equal(severityLevelFromScore(6), 'high');
    assert.equal(severityLevelFromScore(8), 'critical');
    assert.equal(confidenceBand(0.49), 'low');
    assert.equal(confidenceBand(0.5), 'medium');
    assert.equal(confidenceBand(0.8), 'high');
  });

  it('computes a bounded risk percentage', () => {
    assert.equal(computeRiskScore(8, 0.75), 60);
    assert.equal(computeRiskScore(20, 2), 100);
    assert.equal(computeRiskScore(-1, -1), 0);
  });

  it('requires high-confidence critical risk for automatic removal', () => {
    assert.deepEqual(decideActions('critical', 'medium', { autoRemove: true }), [
      'log',
      'flag',
      'isolate',
      'sandbox',
      'immobilize',
      'strip',
    ]);
    assert.ok(decideActions('critical', 'high', { autoRemove: true }).includes('remove'));
  });

  it('adds kill-switch actions only when explicitly requested', () => {
    assert.ok(!decideActions('critical', 'high').includes('kill_carina'));
    const actions = decideActions('critical', 'high', { killSwitch: true });
    assert.ok(actions.includes('kill_carina'));
    assert.ok(actions.includes('lock_host'));
  });
});
