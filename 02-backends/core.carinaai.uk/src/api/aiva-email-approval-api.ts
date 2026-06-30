import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import { isEmailIngestionEnabled } from '../workers/aiva-feature-flags.js';
import {
  listPendingApprovals,
  getApproval,
} from '../ingestion/email/worker-approval-store.js';
import {
  rejectEmailApproval,
  sendApprovedEmail,
} from '../ingestion/email/email-draft-handler.js';

export const aivaEmailApprovalRouter: ExpressRouter = Router();
aivaEmailApprovalRouter.use(requireCloudProxy);

type ApprovalRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: ApprovalRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: ApprovalRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled() || !isEmailIngestionEnabled()) {
    res.status(503).json({ error: 'Email approvals are disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaEmailApprovalRouter.get('/inbox', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  try {
    const approvals = await listPendingApprovals(req.workspaceId!);
    res.json({
      approvals: approvals.map((a) => ({
        id: a.id,
        workerId: a.workerId,
        category: a.category,
        recipient: a.recipient,
        subject: a.subject,
        draftBody: a.draftBody,
        originalFrom: a.originalFrom,
        requestedAt: a.requestedAt.toISOString(),
        timeoutAt: a.timeoutAt.toISOString(),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailApprovalRouter.get('/:id', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }
  const approval = await getApproval(req.workspaceId!, approvalId);
  if (!approval) {
    res.status(404).json({ error: 'Approval not found' });
    return;
  }
  res.json({ approval });
});

aivaEmailApprovalRouter.post('/:id/approve', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  const reviewedBy = String(req.body?.reviewedBy ?? req.headers['x-user-id'] ?? 'workspace_owner');
  const modifiedBody = req.body?.modifiedBody ? String(req.body.modifiedBody) : undefined;

  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }

  try {
    const result = await sendApprovedEmail({
      workspaceId: req.workspaceId!,
      approvalId,
      reviewedBy,
      modifiedBody,
    });
    if (!result) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }
    res.json({ ok: true, approval: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaEmailApprovalRouter.post('/:id/reject', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  const reviewedBy = String(req.body?.reviewedBy ?? req.headers['x-user-id'] ?? 'workspace_owner');

  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }

  try {
    const result = await rejectEmailApproval({
      workspaceId: req.workspaceId!,
      approvalId,
      reviewedBy,
    });
    if (!result) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }
    res.json({ ok: true, approval: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
