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
  try {
    const result = await pool.query<AnomalyScoreRow>(
      `SELECT id, instance_id, session_id, metric_name,
              current_value, baseline_mean, z_score, is_anomaly, detected_at
       FROM anomaly_scores
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json(
      result.rows.map((row) => ({
        ...row,
        detected_at: new Date(row.detected_at).toISOString(),
      })),
    );
  } catch (err) {
    console.error('[Anomalies] /recent error:', err);
    res.status(500).json({ error: 'Failed to fetch anomaly scores' });
  }
});
