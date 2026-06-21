import { Router, type IRouter } from 'express';
import type { Response } from 'express';
import type { ScoutAuth } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/auth.js';
import { requireOperatorAuth } from '../middleware/operator-auth.js';
import {
  approvePendingApproval,
  clampExpiresInSecs,
  createPendingApproval,
  expireApprovalIfNeeded,
  getApprovalById,
  listApprovalHistory,
  listPendingApprovals,
  rejectPendingApproval,
  type ApprovalStatus,
} from '../lib/pending-approvals.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const approvalsRouter: IRouter = Router();

type ScoutRequest = RequestWithScoutAuth;

function operatorName(req: ScoutRequest, fallback = 'operator'): string {
  const body = req.body as Record<string, unknown> | undefined;
  if (typeof body?.decided_by === 'string' && body.decided_by.trim()) {
    return body.decided_by.trim();
  }
  if (req.scoutAuth?.kind === 'operator') return 'operator';
  if (req.session?.accountId) return `account:${req.session.accountId}`;
  return fallback;
}

approvalsRouter.post('/request', requireApiKey, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.instance_id !== 'string' || !body.instance_id.trim()) {
      res.status(400).json({ error: 'instance_id is required' });
      return;
    }
    if (typeof body.session_id !== 'string' || !body.session_id.trim()) {
      res.status(400).json({ error: 'session_id is required' });
      return;
    }

    const expiresInSecs = clampExpiresInSecs(
      typeof body.expires_in_secs === 'number' ? body.expires_in_secs : undefined,
    );

    const row = await createPendingApproval({
      instanceId: body.instance_id.trim(),
      sessionId: body.session_id.trim(),
      toolName: typeof body.tool_name === 'string' ? body.tool_name : undefined,
      actionType: typeof body.action_type === 'string' ? body.action_type : undefined,
      content: typeof body.content === 'string' ? body.content : undefined,
      params: typeof body.params === 'object' && body.params !== null && !Array.isArray(body.params)
        ? body.params as Record<string, unknown>
        : undefined,
      riskScore: typeof body.risk_score === 'number' ? body.risk_score : undefined,
      policyPack: typeof body.policy_pack === 'string' ? body.policy_pack : undefined,
      regulatoryCategory: typeof body.regulatory_category === 'string' ? body.regulatory_category : undefined,
      regulation: typeof body.regulation === 'string' ? body.regulation : undefined,
      expiresInSecs,
    });

    res.status(201).json({
      approval_id: row.id,
      expires_at: row.expires_at.toISOString(),
      status: 'pending',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] request failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

approvalsRouter.get('/pending', requireOperatorAuth, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id : undefined;
    const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20;
    const rows = await listPendingApprovals(instanceId, Number.isFinite(limit) ? limit : 20);
    res.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] pending list failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

approvalsRouter.get('/history', requireOperatorAuth, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status as ApprovalStatus : undefined;
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20;
    const rows = await listApprovalHistory({
      status,
      since,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    res.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] history list failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

approvalsRouter.get('/:id/status', requireApiKey, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const row = await getApprovalById(id);
    if (!row) {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }

    const current = await expireApprovalIfNeeded(row);
    res.json({
      approval_id: current.id,
      status: current.status,
      decided_by: current.decided_by ?? undefined,
      decided_at: current.decided_at?.toISOString(),
      rejection_reason: current.rejection_reason ?? undefined,
      expires_at: current.expires_at.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] status failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

approvalsRouter.post('/:id/approve', requireOperatorAuth, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const result = await approvePendingApproval(id, operatorName(req));
    if (result === 'not_found') {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }
    if (result === 'already_decided') {
      res.status(409).json({ error: 'Approval already decided' });
      return;
    }

    res.json({ ok: true, approval_id: result.id, status: 'approved' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] approve failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

approvalsRouter.post('/:id/reject', requireOperatorAuth, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const body = req.body as Record<string, unknown> | undefined;
    const reason = typeof body?.reason === 'string' ? body.reason : undefined;
    const result = await rejectPendingApproval(id, operatorName(req), reason);
    if (result === 'not_found') {
      res.status(404).json({ error: 'Approval not found' });
      return;
    }
    if (result === 'already_decided') {
      res.status(409).json({ error: 'Approval already decided' });
      return;
    }

    res.json({ ok: true, approval_id: result.id, status: 'rejected' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:approvals] reject failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
