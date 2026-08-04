import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import {
  countPendingSocialApprovals,
  getSocialApproval,
  listPendingSocialApprovals,
} from '../ingestion/social/social-approval-store.js';
import {
  approveSocialApproval,
  patchSocialApprovalDraft,
  rejectSocialApproval,
} from '../ingestion/social/social-send-on-approve.js';

export const aivaSocialApprovalRouter: ExpressRouter = Router();
aivaSocialApprovalRouter.use(requireCloudProxy);

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
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'Social approvals are disabled' });
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

function maskContactId(contactId: string): string {
  const trimmed = contactId.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function mapApproval(a: Awaited<ReturnType<typeof listPendingSocialApprovals>>[number]) {
  return {
    id: a.id,
    workerId: a.workerId,
    workerName: a.workerName ?? null,
    workerRoleName: a.workerRoleName ?? null,
    workerTemplateId: a.workerTemplateId ?? null,
    channel: a.channel,
    contactId: maskContactId(a.contactId),
    conversationId: a.conversationId,
    inboundText: a.inboundText,
    draftText: a.draftText,
    messageType: a.messageType,
    scheduledFor: a.scheduledFor?.toISOString() ?? null,
    requestedAt: a.requestedAt.toISOString(),
    timeoutAt: a.timeoutAt.toISOString(),
  };
}

aivaSocialApprovalRouter.get('/inbox', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  try {
    const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
    const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
    const approvals = await listPendingSocialApprovals(req.workspaceId!, { workerId, channel });
    res.json({ approvals: approvals.map(mapApproval) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaSocialApprovalRouter.get('/pending-count', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  try {
    const count = await countPendingSocialApprovals(req.workspaceId!);
    res.json({ count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaSocialApprovalRouter.get('/:id', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }
  const approval = await getSocialApproval(req.workspaceId!, approvalId);
  if (!approval) {
    res.status(404).json({ error: 'Approval not found' });
    return;
  }
  res.json({ approval: mapApproval(approval) });
});

aivaSocialApprovalRouter.patch('/:id', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  const draftText = String(req.body?.draftText ?? '');
  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }
  if (!draftText.trim()) {
    res.status(400).json({ error: 'draftText is required' });
    return;
  }
  try {
    const result = await patchSocialApprovalDraft({
      workspaceId: req.workspaceId!,
      approvalId,
      draftText,
    });
    if (!result) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }
    res.json({ ok: true, approval: mapApproval(result) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaSocialApprovalRouter.post('/:id/approve', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  const decisionBy = String(req.body?.reviewedBy ?? req.headers['x-user-id'] ?? 'workspace_owner');
  const modifiedDraft = req.body?.modifiedBody
    ? String(req.body.modifiedBody)
    : req.body?.draftText
      ? String(req.body.draftText)
      : undefined;

  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }

  try {
    const result = await approveSocialApproval({
      workspaceId: req.workspaceId!,
      approvalId,
      decisionBy,
      modifiedDraft,
    });
    if (!result) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }
    res.json({ ok: true, approval: mapApproval(result) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaSocialApprovalRouter.post('/:id/reject', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  const approvalId = String(req.params.id ?? '');
  const decisionBy = String(req.body?.reviewedBy ?? req.headers['x-user-id'] ?? 'workspace_owner');

  if (!UUID_RE.test(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }

  try {
    const result = await rejectSocialApproval({
      workspaceId: req.workspaceId!,
      approvalId,
      decisionBy,
    });
    if (!result) {
      res.status(404).json({ error: 'Approval not found or already resolved' });
      return;
    }
    res.json({ ok: true, approval: mapApproval(result) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
