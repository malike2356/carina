import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import {
  listPendingApprovals,
  countPendingEmailApprovals,
  getApproval,
  createEmailApproval,
} from '../ingestion/email/worker-approval-store.js';
import {
  rejectEmailApproval,
  sendApprovedEmail,
} from '../ingestion/email/email-draft-handler.js';
import { getWorker } from '../workers/worker-store.js';
import type { EmailCategory } from '../ingestion/email/email-categorizer.js';

export const aivaEmailApprovalRouter: ExpressRouter = Router();
aivaEmailApprovalRouter.use(requireCloudProxy);

type ApprovalRequest = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES: EmailCategory[] = ['client_query', 'invoice', 'spam', 'urgent', 'other'];

function resolveWorkspaceId(req: ApprovalRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: ApprovalRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'Email approvals are disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  // Approvals serve both IMAP ingestion and Gmail-synced Email page drafts.
  req.workspaceId = workspaceId;
  next();
}

aivaEmailApprovalRouter.post('/', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  try {
    const workerId = String(req.body?.workerId ?? '').trim();
    const recipient = String(req.body?.recipient ?? '').trim();
    const subject = String(req.body?.subject ?? '').trim();
    const draftBody = String(req.body?.draftBody ?? '').trim();
    const originalFrom = String(req.body?.originalFrom ?? recipient).trim();
    const messageId = String(req.body?.messageId ?? '').trim() || undefined;
    const categoryRaw = String(req.body?.category ?? 'client_query').trim();
    const category = (CATEGORIES.includes(categoryRaw as EmailCategory)
      ? categoryRaw
      : 'client_query') as EmailCategory;

    if (!workerId || !UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Valid workerId is required' });
      return;
    }
    if (!recipient || !subject || !draftBody) {
      res.status(400).json({ error: 'recipient, subject, and draftBody are required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const approval = await createEmailApproval({
      workerId,
      workspaceId: req.workspaceId!,
      messageId,
      category,
      recipient,
      subject,
      draftBody,
      originalFrom,
    });

    res.status(201).json({
      ok: true,
      approval: {
        id: approval.id,
        workerId: approval.workerId,
        recipient: approval.recipient,
        subject: approval.subject,
        draftBody: approval.draftBody,
        status: approval.status,
        requestedAt: approval.requestedAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

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

aivaEmailApprovalRouter.get('/pending-count', requireWorkspace, async (req: ApprovalRequest, res: Response) => {
  try {
    const count = await countPendingEmailApprovals(req.workspaceId!);
    res.json({ count });
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
