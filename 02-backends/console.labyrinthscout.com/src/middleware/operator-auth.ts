import type { Request, Response, NextFunction } from 'express';
import { requireApiKey } from './auth.js';
import { requireAccount } from './account-session.js';
import { isOperatorAuth } from '../lib/scope.js';
import type { RequestWithScoutAuth } from '../types/request.js';

/**
 * Operator routes accept either a signed-in account session (browser)
 * or the Scout API key (dashboard / automation).
 * Session auth also stamps scoutAuth so scopedAccountId() works.
 */
export function requireOperatorAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.accountId) {
    requireAccount(req, res, () => {
      (req as RequestWithScoutAuth).scoutAuth = {
        kind: 'account',
        accountId: req.session.accountId as string,
      };
      next();
    });
    return;
  }
  requireApiKey(req as RequestWithScoutAuth, res, next);
}

/** Requires the global operator SCOUT_API_KEY (not a subscriber account key). */
export function requireOperatorKeyOnly(req: RequestWithScoutAuth, res: Response, next: NextFunction): void {
  if (!isOperatorAuth(req)) {
    res.status(403).json({ error: 'Operator access required' });
    return;
  }
  next();
}
