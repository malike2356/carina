import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { resumeInstance } from '../lib/instance-control.js';
import { requestScoutEngineJson } from '../lib/scout-engine-client.js';

export const resumeRouter: IRouter = Router();

resumeRouter.post('/:instanceId', async (req: Request, res: Response): Promise<void> => {
  const instanceId = String(req.params.instanceId ?? '');
  if (!instanceId) {
    res.status(400).json({ error: 'Instance id required' });
    return;
  }

  try {
    const organizationId = await resolveOrganizationId(instanceId);
    if (organizationId) {
      const upstream = await requestScoutEngineJson(req, {
        method: 'POST',
        path: '/api/internal/control/resume',
        body: {
          organization_id: organizationId,
          agent_id: instanceId,
          source: 'dashboard',
          command: 'resume',
          confirmed: true,
        },
        headers: {
          'X-Scout-Internal-Key': process.env.SCOUT_ENGINE_API_KEY?.trim()
            || process.env.SCOUT_API_KEY?.trim()
            || '',
        },
      });

      if (upstream) {
        const body = parseJson(upstream.text);
        if (upstream.status >= 200 && upstream.status < 300 && body && body.ok) {
          res.json({
            ok: true,
            instance_id: instanceId,
            status: 'active',
            audit_code: body.audit_code,
          });
          return;
        }
        res.status(upstream.status).json(body ?? { error: 'Engine control request failed' });
        return;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout:resume] Engine control unavailable, falling back locally:', msg);
  }

  try {
    const result = await resumeInstance(instanceId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ ok: true, instance_id: result.instance_id, status: result.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:resume] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function resolveOrganizationId(instanceId: string): Promise<string | null> {
  const result = await pool.query<{ account_id: string | null }>(
    `SELECT account_id FROM carina_instances WHERE id = $1`,
    [instanceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return row.account_id?.trim() || instanceId;
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
