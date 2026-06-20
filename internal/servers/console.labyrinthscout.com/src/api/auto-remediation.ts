import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  applyRemediation,
  getRemediationRules,
  rollbackRemediation,
  type RemediationCase,
} from '../security/auto-remediation.js';

export const autoRemediationRouter: IRouter = Router();

const VALID_CASES = new Set<RemediationCase>([
  'suspicious_egress', 'repeated_injection', 'unknown_plugin', 'risky_burst', 'stale_marker',
]);

autoRemediationRouter.get('/rules', (_req, res) => {
  res.json({ rules: getRemediationRules() });
});

autoRemediationRouter.post('/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const caseId = typeof body.case === 'string' && VALID_CASES.has(body.case as RemediationCase)
      ? body.case as RemediationCase
      : null;
    if (!caseId || typeof body.session_id !== 'string' || typeof body.instance_id !== 'string') {
      res.status(400).json({ error: 'case, session_id, and instance_id are required' });
      return;
    }

    const result = await applyRemediation({
      case: caseId,
      sessionId: body.session_id,
      instanceId: body.instance_id,
      reason: typeof body.reason === 'string' ? body.reason : 'auto-remediation triggered',
      metadata: typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : undefined,
    });

    res.json(result);
  } catch (err) {
    console.error('[scout:auto-remediation] apply failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

autoRemediationRouter.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const caseId = typeof body.case === 'string' && VALID_CASES.has(body.case as RemediationCase)
      ? body.case as RemediationCase
      : null;
    if (!caseId || typeof body.session_id !== 'string' || typeof body.instance_id !== 'string') {
      res.status(400).json({ error: 'case, session_id, and instance_id are required' });
      return;
    }

    const result = await rollbackRemediation({
      case: caseId,
      sessionId: body.session_id,
      instanceId: body.instance_id,
    });

    res.json(result);
  } catch (err) {
    console.error('[scout:auto-remediation] rollback failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
