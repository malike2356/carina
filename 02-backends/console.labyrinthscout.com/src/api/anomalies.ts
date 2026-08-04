import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

export const anomaliesRouter: IRouter = Router();

interface AnomalyScoreRow {
  id: string;
  instance_id: string;
  session_id: string;
  metric_name: string;
  current_value: number;
  baseline_mean: number;
  z_score: number;
  is_anomaly: boolean;
  detected_at: Date;
}

interface BaselineRow {
  instance_id: string;
  metric_name: string;
  mean_value: number;
  std_dev: number;
  sample_count: number;
  computed_at: Date;
}

anomaliesRouter.get('/baselines', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<BaselineRow>(
      `SELECT instance_id, metric_name, mean_value, std_dev, sample_count, computed_at
       FROM anomaly_baselines
       ORDER BY instance_id, metric_name`,
    );
    res.json({
      baselines: result.rows.map((row) => ({
        ...row,
        confidence: Math.min(1, row.sample_count / 30),
        computed_at: new Date(row.computed_at).toISOString(),
      })),
    });
  } catch (err) {
    console.error('[Anomalies] /baselines error:', err);
    res.status(500).json({ error: 'Failed to fetch anomaly baselines' });
  }
});

anomaliesRouter.get('/recent', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const onlyAnomalies = req.query.all !== 'true';
  try {
    const result = await pool.query<AnomalyScoreRow>(
      onlyAnomalies
        ? `SELECT id, instance_id, session_id, metric_name,
                  current_value, baseline_mean, z_score, is_anomaly, detected_at
           FROM anomaly_scores
           WHERE is_anomaly = TRUE
           ORDER BY detected_at DESC
           LIMIT $1`
        : `SELECT id, instance_id, session_id, metric_name,
                  current_value, baseline_mean, z_score, is_anomaly, detected_at
           FROM anomaly_scores
           ORDER BY detected_at DESC
           LIMIT $1`,
      [limit],
    );
    const anomalies = result.rows.map((row) => {
      const z = Number(row.z_score) || 0;
      const severity = z >= 5 ? 'critical' : z >= 3 ? 'warning' : 'info';
      return {
        id: row.id,
        instance_id: row.instance_id,
        session_id: row.session_id,
        metric_name: row.metric_name,
        metric: row.metric_name,
        anomaly_type: row.metric_name,
        type: row.metric_name,
        current_value: row.current_value,
        value: row.current_value,
        baseline_mean: row.baseline_mean,
        baseline: row.baseline_mean,
        z_score: z,
        deviation: z,
        is_anomaly: row.is_anomaly,
        severity,
        detected_at: new Date(row.detected_at).toISOString(),
      };
    });
    res.json({ anomalies, count: anomalies.length });
  } catch (err) {
    console.error('[Anomalies] /recent error:', err);
    res.status(500).json({ error: 'Failed to fetch anomaly scores' });
  }
});
