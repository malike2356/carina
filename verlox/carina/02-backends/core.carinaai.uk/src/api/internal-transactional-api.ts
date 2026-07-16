import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { sendPasswordResetEmail } from '../email/email-triggers.js';

export const internalTransactionalApiRouter: ExpressRouter = Router();

function resolveExpectedInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

export function isInternalTransactionalAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const expected = resolveExpectedInternalKey();
  if (!expected) return false;
  const headerKey = String(req.headers['x-internal-key'] ?? '').trim();
  return headerKey === expected;
}

internalTransactionalApiRouter.use((req: Request, res: Response, next) => {
  if (isInternalTransactionalAuthorized(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
});

internalTransactionalApiRouter.post('/password-reset', async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const resetUrl = String(req.body?.resetUrl ?? '').trim();
  const expiresInMinutes = Number(req.body?.expiresInMinutes ?? 60);

  if (!email || !resetUrl) {
    res.status(400).json({ error: 'email and resetUrl are required' });
    return;
  }

  try {
    await sendPasswordResetEmail({
      email,
      resetUrl,
      expiresInMinutes: Number.isFinite(expiresInMinutes) ? expiresInMinutes : 60,
    });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[internal-transactional] password reset email failed:', message);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});
