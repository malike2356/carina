import { describe, expect, it } from 'vitest';
import {
  cancelSubagent,
  registerSubagentCancel,
  unregisterSubagentCancel,
  _resetSubagentCancelRegistryForTests,
} from './subagent-cancel-registry.js';
import { listSubagentMetrics, _resetSubagentMetricsForTests } from '../telemetry/subagent-metrics.js';

describe('subagent cancel registry', () => {
  it('invokes cancel handler and records cancelled metric', () => {
    _resetSubagentCancelRegistryForTests();
    _resetSubagentMetricsForTests();
    let cancelled = false;
    registerSubagentCancel('sess-1', 'research', () => {
      cancelled = true;
    });

    expect(cancelSubagent('sess-1', 'research')).toBe(true);
    expect(cancelled).toBe(true);
    expect(listSubagentMetrics(1)[0]?.status).toBe('cancelled');
  });

  it('returns false when no handle is registered', () => {
    _resetSubagentCancelRegistryForTests();
    expect(cancelSubagent('missing', 'research')).toBe(false);
  });

  it('unregister removes handle without cancelling', () => {
    _resetSubagentCancelRegistryForTests();
    let cancelled = false;
    registerSubagentCancel('sess-2', 'coding', () => {
      cancelled = true;
    });
    unregisterSubagentCancel('sess-2', 'coding');
    expect(cancelSubagent('sess-2', 'coding')).toBe(false);
    expect(cancelled).toBe(false);
  });
});
