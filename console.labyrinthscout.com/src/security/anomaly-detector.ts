import type pg from 'pg';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { alertDispatcher } from '../alerts/dispatcher.js';
import type { SecurityEvent } from '../alerts/types.js';
import {
  ANOMALY_RESPONSES,
  type AnomalySeverity,
  type AnomalyType,
} from './anomaly-types.js';

export interface SessionMetrics {
  tool_calls_per_5min: number;
  unique_tools_used: number;
  avg_response_length: number;
  shell_exec_count: number;
  http_request_count: number;
  injection_attempt_count: number;
  egress_blocked_count: number;
  tokens_per_hour?: number;
  hour_utc?: number;
  tool_sequence?: string[];
  tool_name?: string;
  tool_calls_last_minute?: number;
  ip?: string;
  location?: string;
  command?: string;
  path?: string;
}

export interface AnomalyResult {
  metricName: string;
  anomalyType?: AnomalyType;
  currentValue: number;
  baselineMean: number;
  zScore: number;
  isCritical: boolean;
  severity?: AnomalySeverity;
  autoAction?: string;
}

interface BaselineRow {
  metric_name: string;
  mean_value: number;
  std_dev: number;
  sample_count: number;
}

const Z_ANOMALY_THRESHOLD = 3.0;
const Z_CRITICAL_THRESHOLD = 5.0;
const MIN_SAMPLES = 10;
const METRIC_NAMES: (keyof SessionMetrics)[] = [
  'tool_calls_per_5min',
  'unique_tools_used',
  'avg_response_length',
  'shell_exec_count',
  'http_request_count',
  'injection_attempt_count',
  'egress_blocked_count',
  'tokens_per_hour',
];
const NUMERIC_METRIC_NAMES = new Set<string>(METRIC_NAMES);

const baselineCache = new Map<string, { row: BaselineRow; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(instanceId: string, metricName: string): string {
  return `${instanceId}:${metricName}`;
}

export function _resetBaselineCache(): void {
  baselineCache.clear();
}

function computeMeanStd(values: number[]): { mean: number; stdDev: number } {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return { mean, stdDev: Math.sqrt(variance) };
}

function parseSessionMetrics(description: string): SessionMetrics | null {
  try {
    const parsed = JSON.parse(description) as SessionMetrics;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class BaselineLearner {
  constructor(private readonly db: pg.Pool) {}

  async computeBaselines(instanceId: string): Promise<void> {
    const result = await this.db.query<{ description: string }>(
      `SELECT description FROM security_events
       WHERE instance_id = $1
         AND event_type = 'session_metrics'
         AND created_at > NOW() - INTERVAL '7 days'`,
      [instanceId],
    );

    const metricValues = new Map<keyof SessionMetrics, number[]>();
    for (const name of METRIC_NAMES) {
      metricValues.set(name, []);
    }

    for (const row of result.rows) {
      const metrics = parseSessionMetrics(row.description);
      if (!metrics) continue;
      for (const name of METRIC_NAMES) {
        const value = metrics[name];
        if (typeof value === 'number' && Number.isFinite(value)) {
          metricValues.get(name)?.push(value);
        }
      }
    }

    let upserted = 0;
    for (const name of METRIC_NAMES) {
      const values = metricValues.get(name) ?? [];
      if (values.length < MIN_SAMPLES) continue;

      const { mean, stdDev } = computeMeanStd(values);
      await this.db.query(
        `INSERT INTO anomaly_baselines (instance_id, metric_name, mean_value, std_dev, sample_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (instance_id, metric_name)
         DO UPDATE SET
           mean_value = EXCLUDED.mean_value,
           std_dev = EXCLUDED.std_dev,
           sample_count = EXCLUDED.sample_count,
           computed_at = NOW()`,
        [instanceId, name, mean, stdDev, values.length],
      );
      upserted += 1;
    }

    for (const key of baselineCache.keys()) {
      if (key.startsWith(`${instanceId}:`)) baselineCache.delete(key);
    }

    console.info('[BaselineLearner] Baselines computed for', instanceId, '- metrics:', upserted);
  }
}

export class AnomalyDetector {
  constructor(
    private readonly db: pg.Pool,
    private readonly dispatcher: { dispatch(event: SecurityEvent): Promise<void> },
  ) {}

  async detect(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult[]> {
    const results: AnomalyResult[] = [];

    for (const [metricName, rawValue] of Object.entries(metrics) as Array<
      [keyof SessionMetrics, number | undefined]
    >) {
      if (!NUMERIC_METRIC_NAMES.has(metricName)) continue;
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue;

      const baseline = await this.loadBaseline(instanceId, metricName);
      if (!baseline) continue;
      if (baseline.std_dev < 0.001) continue;

      const zScore = Math.abs((rawValue - baseline.mean_value) / baseline.std_dev);
      const isAnomaly = zScore >= Z_ANOMALY_THRESHOLD;
      const isCritical = zScore >= Z_CRITICAL_THRESHOLD;

      await this.db.query(
        `INSERT INTO anomaly_scores
          (instance_id, session_id, metric_name, current_value, baseline_mean, z_score, is_anomaly)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          instanceId,
          sessionId,
          metricName,
          rawValue,
          baseline.mean_value,
          zScore,
          isAnomaly,
        ],
      );

      if (isAnomaly) {
        results.push({
          metricName,
          currentValue: rawValue,
          baselineMean: baseline.mean_value,
          zScore,
          isCritical,
        });
      }

      if (isCritical) {
        await this.dispatcher.dispatch({
          id: randomUUID(),
          instance_id: instanceId,
          session_id: sessionId,
          event_type: 'anomaly_detected',
          severity: 'critical',
          description: JSON.stringify({
            metricName,
            zScore,
            currentValue: rawValue,
            baselineMean: baseline.mean_value,
          }),
          created_at: new Date(),
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
        });
      }
    }

    results.push(...await this.detectHeuristics(instanceId, sessionId, metrics));
    return results;
  }

  private async detectHeuristics(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult[]> {
    const checks = [
      await this.detectTokenSpike(instanceId, sessionId, metrics),
      await this.detectUnusualToolSequence(instanceId, sessionId, metrics),
      await this.detectUnusualHours(instanceId, sessionId, metrics),
      await this.detectNewToolUsage(instanceId, sessionId, metrics),
      await this.detectRapidCycling(instanceId, sessionId, metrics),
      await this.detectSensitiveToolAccess(instanceId, sessionId, metrics),
      await this.detectNewIpLocation(instanceId, sessionId, metrics),
    ];

    return checks.filter((result): result is AnomalyResult => result !== null);
  }

  private async detectTokenSpike(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    if (typeof metrics.tokens_per_hour !== 'number') return null;
    const baseline = await this.loadBaseline(instanceId, 'tokens_per_hour');
    if (!baseline || baseline.mean_value <= 0) return null;
    if (metrics.tokens_per_hour < baseline.mean_value * 3) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'token_spike',
      'tokens_per_hour',
      metrics.tokens_per_hour,
      baseline.mean_value,
      baseline.std_dev > 0 ? (metrics.tokens_per_hour - baseline.mean_value) / baseline.std_dev : 3,
    );
  }

  private async detectUnusualToolSequence(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    const sequence = metrics.tool_sequence;
    if (!Array.isArray(sequence) || sequence.length < 3) return null;
    const canonical = sequence.map((tool) => tool.replace('shell-exec', 'terminal'));
    const terminalCount = canonical.filter((tool) => tool === 'terminal').length;
    const hasDestructiveTool = canonical.some((tool) => /delete|rm|write_file/.test(tool));
    if (terminalCount < 3 || !hasDestructiveTool) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'unusual_tool_sequence',
      'tool_sequence',
      sequence.length,
      0,
      3,
    );
  }

  private async detectUnusualHours(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    if (typeof metrics.hour_utc !== 'number') return null;
    const hour = metrics.hour_utc;
    if (hour < 2 || hour > 6) return null;

    return this.emitAnomaly(instanceId, sessionId, 'unusual_hours', 'hour_utc', hour, 12, 3);
  }

  private async detectNewToolUsage(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    if (typeof metrics.tool_name !== 'string' || metrics.tool_name.length === 0) return null;
    const baseline = await this.loadBaseline(instanceId, `tool_used:${metrics.tool_name}`);
    if (baseline) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'new_tool_usage',
      'new_tool_usage',
      1,
      0,
      3,
    );
  }

  private async detectRapidCycling(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    if (typeof metrics.tool_calls_last_minute !== 'number') return null;
    if (metrics.tool_calls_last_minute < 15) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'rapid_cycling',
      'tool_calls_last_minute',
      metrics.tool_calls_last_minute,
      10,
      3,
    );
  }

  private async detectSensitiveToolAccess(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    const toolName = metrics.tool_name?.replace('shell-exec', 'terminal');
    const command = metrics.command ?? '';
    const path = metrics.path ?? '';
    const isSensitive =
      (toolName === 'terminal' && /\bsudo\b/.test(command)) ||
      ((toolName === 'write_file' || toolName === 'delete') && path.startsWith('/etc/'));
    if (!isSensitive) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'sensitive_tool_access',
      'sensitive_tool_access',
      1,
      0,
      5,
    );
  }

  private async detectNewIpLocation(
    instanceId: string,
    sessionId: string,
    metrics: Partial<SessionMetrics>,
  ): Promise<AnomalyResult | null> {
    const ip = typeof metrics.ip === 'string' ? metrics.ip : '';
    const location = typeof metrics.location === 'string' ? metrics.location : '';
    if (!ip && !location) return null;

    const key = ip ? `known_ip:${ip}` : `known_location:${location}`;
    const baseline = await this.loadBaseline(instanceId, key);
    if (baseline) return null;

    return this.emitAnomaly(
      instanceId,
      sessionId,
      'new_ip_location',
      'new_ip_location',
      1,
      0,
      1,
    );
  }

  private async emitAnomaly(
    instanceId: string,
    sessionId: string,
    anomalyType: AnomalyType,
    metricName: string,
    currentValue: number,
    baselineMean: number,
    zScore: number,
  ): Promise<AnomalyResult> {
    const response = ANOMALY_RESPONSES[anomalyType];
    const result: AnomalyResult = {
      metricName,
      anomalyType,
      currentValue,
      baselineMean,
      zScore,
      isCritical: response.severity === 'critical',
      severity: response.severity,
      autoAction: response.autoAction,
    };

    await this.db.query(
      `INSERT INTO anomaly_scores
        (instance_id, session_id, metric_name, current_value, baseline_mean, z_score, is_anomaly)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [instanceId, sessionId, anomalyType, currentValue, baselineMean, zScore],
    );

    await this.dispatcher.dispatch({
      id: randomUUID(),
      instance_id: instanceId,
      session_id: sessionId,
      event_type: 'anomaly_detected',
      severity: response.severity === 'low' ? 'info' :
        response.severity === 'medium' ? 'warning' : 'critical',
      description: JSON.stringify({ anomalyType, metricName, currentValue, autoAction: response.autoAction }),
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });

    return result;
  }

  private async loadBaseline(
    instanceId: string,
    metricName: string,
  ): Promise<BaselineRow | null> {
    const key = cacheKey(instanceId, metricName);
    const cached = baselineCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.row;
    }

    const result = await this.db.query<BaselineRow>(
      `SELECT metric_name, mean_value, std_dev, sample_count
       FROM anomaly_baselines
       WHERE instance_id = $1 AND metric_name = $2`,
      [instanceId, metricName],
    );

    const row = result.rows[0];
    if (!row) return null;

    baselineCache.set(key, { row, expiresAt: Date.now() + CACHE_TTL_MS });
    return row;
  }
}

export const baselineLearner = new BaselineLearner(pool);
export const anomalyDetector = new AnomalyDetector(pool, alertDispatcher);
