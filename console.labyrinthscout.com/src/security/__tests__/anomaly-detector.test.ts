import { describe, it, expect, vi, beforeEach } from 'vitest';
import type pg from 'pg';
import {
  AnomalyDetector,
  BaselineLearner,
  _resetBaselineCache,
  type SessionMetrics,
} from '../anomaly-detector.js';

const queryMock = vi.fn();
const dispatchMock = vi.fn().mockResolvedValue(undefined);

function makePool(): pg.Pool {
  return { query: queryMock } as unknown as pg.Pool;
}

function fullMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
    tool_calls_per_5min: 0,
    unique_tools_used: 0,
    avg_response_length: 0,
    shell_exec_count: 0,
    http_request_count: 0,
    injection_attempt_count: 0,
    egress_blocked_count: 0,
    ...overrides,
  };
}

function baselineRow(mean: number, stdDev: number) {
  return {
    metric_name: 'tool_calls_per_5min',
    mean_value: mean,
    std_dev: stdDev,
    sample_count: 20,
  };
}

describe('AnomalyDetector', () => {
  beforeEach(() => {
    queryMock.mockReset();
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
    _resetBaselineCache();
  });

  it('returns empty array when no baseline data exists', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    await expect(
      detector.detect('carina-local', 'session-1', { tool_calls_per_5min: 5 }),
    ).resolves.toEqual([]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('does not flag z-score of 2 (below threshold)', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [baselineRow(3, 1)] })
      .mockResolvedValueOnce({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_calls_per_5min: 5,
    });

    expect(result).toEqual([]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('flags z-score of 4 as anomaly (non-critical)', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [baselineRow(3, 1)] })
      .mockResolvedValueOnce({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_calls_per_5min: 7,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.zScore).toBeCloseTo(4, 5);
    expect(result[0]?.isCritical).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('dispatches critical alert when z-score exceeds 5', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [baselineRow(3, 1)] })
      .mockResolvedValueOnce({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_calls_per_5min: 9,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.zScore).toBeCloseTo(6, 5);
    expect(result[0]?.isCritical).toBe(true);
    expect(dispatchMock).toHaveBeenCalledOnce();
    expect(dispatchMock.mock.calls[0]?.[0]).toMatchObject({
      severity: 'critical',
      event_type: 'anomaly_detected',
    });
  });

  it('skips metric when std_dev is zero to avoid NaN', async () => {
    queryMock.mockResolvedValueOnce({ rows: [baselineRow(5, 0)] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_calls_per_5min: 100,
    });

    expect(result).toEqual([]);
    expect(queryMock).toHaveBeenCalledOnce();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('flags token spike as high severity', async () => {
    queryMock.mockResolvedValueOnce({ rows: [baselineRow(100, 10)] }).mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tokens_per_hour: 1000,
    });

    expect(result.some((r) => r.anomalyType === 'token_spike' && r.severity === 'high')).toBe(true);
  });

  it('flags unusual terminal/delete tool sequence', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_sequence: ['terminal', 'terminal', 'terminal', 'delete', 'terminal'],
    });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'unusual_tool_sequence',
      severity: 'medium',
    }));
  });

  it('flags unusual access hours', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', { hour_utc: 3 });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'unusual_hours',
      severity: 'medium',
    }));
  });

  it('flags first-time tool usage', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', { tool_name: 'write_file' });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'new_tool_usage',
      severity: 'medium',
    }));
  });

  it('flags rapid tool cycling', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', { tool_calls_last_minute: 15 });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'rapid_cycling',
      severity: 'high',
    }));
  });

  it('flags sensitive tool access as critical', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      tool_name: 'terminal',
      command: 'sudo cat /etc/shadow',
    });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'sensitive_tool_access',
      severity: 'critical',
      isCritical: true,
    }));
  });

  it('flags new IP or location as low severity', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const detector = new AnomalyDetector(makePool(), { dispatch: dispatchMock });

    const result = await detector.detect('carina-local', 'session-1', {
      ip: '203.0.113.10',
      location: 'London, GB',
    });

    expect(result).toContainEqual(expect.objectContaining({
      anomalyType: 'new_ip_location',
      severity: 'low',
    }));
  });
});

describe('BaselineLearner', () => {
  beforeEach(() => {
    queryMock.mockReset();
    _resetBaselineCache();
  });

  it('skips computation when fewer than 10 samples exist', async () => {
    const rows = Array.from({ length: 5 }, () => ({
      description: JSON.stringify(fullMetrics({ tool_calls_per_5min: 2 })),
    }));
    queryMock.mockResolvedValueOnce({ rows });

    const learner = new BaselineLearner(makePool());
    await learner.computeBaselines('carina-local');

    expect(queryMock).toHaveBeenCalledOnce();
  });

  it('upserts correct mean and std_dev from sample data', async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      description: JSON.stringify(fullMetrics({ tool_calls_per_5min: i + 1 })),
    }));
    queryMock.mockResolvedValueOnce({ rows }).mockResolvedValue({ rows: [] });

    const learner = new BaselineLearner(makePool());
    await learner.computeBaselines('carina-local');

    const values = Array.from({ length: 15 }, (_, i) => i + 1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const upsertCall = queryMock.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO anomaly_baselines'),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall?.[1]).toEqual([
      'carina-local',
      'tool_calls_per_5min',
      mean,
      stdDev,
      15,
    ]);
  });
});
