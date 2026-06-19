import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isWebTotpEnabled, resolveWebTotpSecret } from '../auth/web-totp-store.js';
import { verifyTotpCode } from '../auth/web-totp.js';

export const webAuthApiRouter: ExpressRouter = Router();

webAuthApiRouter.get('/totp/status', async (_req: Request, res: Response) => {
  res.json({ enabled: await isWebTotpEnabled() });
});

webAuthApiRouter.post('/totp/verify', async (req: Request, res: Response) => {
  if (!req.session?.webPendingTotp) {
    res.status(400).json({ error: 'No pending sign-in' });
    return;
  }
  const token = String(req.body?.token ?? '').trim();
  const secret = await resolveWebTotpSecret();
  if (!secret || !verifyTotpCode(secret, token)) {
    res.status(401).json({ error: 'Invalid code' });
    return;
  }
  req.session.webPendingTotp = false;
  req.session.webAuthed = true;
  res.json({ ok: true });
});
