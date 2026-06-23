import { Router, type Request, type Response, type IRouter } from 'express';
import { Resend } from 'resend';
import { config } from '../config/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribeRouter: IRouter = Router();

subscribeRouter.post('/', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  if (!config.resend.apiKey) {
    res.status(503).json({ error: 'Subscribe is not configured yet' });
    return;
  }

  const audienceId = process.env.RESEND_SUBSCRIBE_AUDIENCE_ID ?? '';
  const resend = new Resend(config.resend.apiKey);

  try {
    if (audienceId) {
      await resend.contacts.create({ email, audienceId, unsubscribed: false });
    } else {
      await resend.emails.send({
        from: config.resend.from,
        to: 'contact@verlox.uk',
        subject: 'Skills Hub signup',
        text: `New Skills Hub notification signup: ${email}`,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
