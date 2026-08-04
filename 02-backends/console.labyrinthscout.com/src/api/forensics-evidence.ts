import { Router, type IRouter, type Request, type Response } from 'express';
import { pool } from '../db.js';

export const forensicsEvidenceRouter: IRouter = Router();

type ForensicSyncBody = {
  instance_id?: string;
  snapshot_id?: string;
  incident_id?: string;
  reason?: string;
  hash?: string;
  captured_at?: string;
  session_id?: string;
  artifacts?: Record<string, unknown>;
  agent_state?: Record<string, unknown>;
  security_state?: Record<string, unknown>;
};

forensicsEvidenceRouter.post('/sync', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as ForensicSyncBody;
  const instanceId = typeof body.instance_id === 'string' ? body.instance_id.trim() : '';
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim().slice(0, 500)
    : 'Carina forensic snapshot';

  if (!instanceId) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }

  const artifacts = {
    snapshot_id: body.snapshot_id ?? null,
    incident_id: body.incident_id ?? null,
    hash: body.hash ?? null,
    captured_at: body.captured_at ?? null,
    session_id: body.session_id ?? null,
    artifacts: body.artifacts ?? {},
    agent_state: body.agent_state ?? {},
    security_state: body.security_state ?? {},
  };

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO forensic_snapshots (instance_id, reason, artifacts)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id`,
      [instanceId, reason, JSON.stringify(artifacts)],
    );

    const row = result.rows[0];
    res.status(201).json({
      ok: true,
      snapshot_id: row?.id ?? body.snapshot_id ?? null,
      instance_id: instanceId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[forensics:evidence-sync] failed:', msg);
    res.status(500).json({ error: 'Failed to store forensic snapshot', detail: msg });
  }
});
