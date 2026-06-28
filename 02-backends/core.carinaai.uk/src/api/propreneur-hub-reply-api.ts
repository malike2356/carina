import express, { type Request, type Response, type Router as ExpressRouter } from 'express';
import { queueWebReply } from '../channels/adapters/web-adapter.js';

export const propreneurHubReplyRouter: ExpressRouter = express.Router();

function hubSecret(): string {
  return (process.env.CARINA_HUB_WEBHOOK_SECRET ?? '').trim();
}

propreneurHubReplyRouter.post(
  '/propreneur-reply',
  express.json({ limit: '64kb' }),
  async (req: Request, res: Response) => {
    const secret = hubSecret();
    if (secret === '') {
      res.status(503).json({ error: 'CARINA_HUB_WEBHOOK_SECRET is not configured' });
      return;
    }

    const incoming = req.headers['x-carina-hub-key'];
    const key = Array.isArray(incoming) ? incoming[0] : incoming;
    if (!key || key !== secret) {
      res.status(401).json({ error: 'Invalid hub key' });
      return;
    }

    const { session_id, reply, requires_confirmation } = req.body as {
      session_id?: string;
      reply?: string;
      requires_confirmation?: boolean;
    };

    if (!session_id || !reply) {
      res.status(400).json({ error: 'session_id and reply are required' });
      return;
    }

    let message = String(reply);
    if (requires_confirmation) {
      message += '\n\nNote: Propreneur Carina needs human approval before completing this action.';
    }
    queueWebReply(session_id, message);

    res.status(200).json({ ok: true });
  },
);
