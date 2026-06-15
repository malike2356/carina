import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import {
  getInboundEmail,
  listInboundEmails,
  toEmailResponse,
  updateInboundEmail,
  type EmailTriageStatus,
  type EmailUrgency,
} from './email-store.js';

export const emailApiRouter: ExpressRouter = Router();

type EmailRequest = Request;

function emailAuth(req: EmailRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    next();
    return;
  }
  if (req.session?.webAuthed) {
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

const URGENCIES = new Set<EmailUrgency>(['low', 'normal', 'high']);
const TRIAGE_STATUSES = new Set<EmailTriageStatus>(['inbox', 'archived', 'spam']);

emailApiRouter.use(emailAuth);

emailApiRouter.get('/', async (req: EmailRequest, res: Response) => {
  try {
    const triageStatus = req.query.status
      ? String(req.query.status) as EmailTriageStatus
      : undefined;
    if (triageStatus && !TRIAGE_STATUSES.has(triageStatus)) {
      res.status(400).json({ error: 'Invalid status filter' });
      return;
    }
    const result = await listInboundEmails({
      limit: Number(req.query.limit) || 50,
      unreadOnly: req.query.unread === 'true',
      triageStatus,
      q: req.query.q ? String(req.query.q) : undefined,
    });
    res.json({
      emails: result.emails.map(toEmailResponse),
      total: result.total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

emailApiRouter.get('/:id', async (req: EmailRequest, res: Response) => {
  try {
    const email = await getInboundEmail(String(req.params.id));
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(toEmailResponse(email));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

emailApiRouter.patch('/:id', async (req: EmailRequest, res: Response) => {
  try {
    const patch: Partial<{ read: boolean; urgency: EmailUrgency; triage_status: EmailTriageStatus }> = {};
    if (req.body?.read != null) patch.read = Boolean(req.body.read);
    if (req.body?.urgency != null) {
      const urgency = String(req.body.urgency) as EmailUrgency;
      if (!URGENCIES.has(urgency)) {
        res.status(400).json({ error: 'Invalid urgency' });
        return;
      }
      patch.urgency = urgency;
    }
    if (req.body?.triage_status != null) {
      const status = String(req.body.triage_status) as EmailTriageStatus;
      if (!TRIAGE_STATUSES.has(status)) {
        res.status(400).json({ error: 'Invalid triage_status' });
        return;
      }
      patch.triage_status = status;
    }

    const updated = await updateInboundEmail(String(req.params.id), patch);
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(toEmailResponse(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

emailApiRouter.post('/:id/archive', async (req: EmailRequest, res: Response) => {
  try {
    const updated = await updateInboundEmail(String(req.params.id), {
      read: true,
      triage_status: 'archived',
    });
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(toEmailResponse(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

emailApiRouter.post('/:id/spam', async (req: EmailRequest, res: Response) => {
  try {
    const updated = await updateInboundEmail(String(req.params.id), {
      read: true,
      triage_status: 'spam',
    });
    if (!updated) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(toEmailResponse(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
