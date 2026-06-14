import type { Request, Response, NextFunction } from 'express';
import { requireApiKey } from './auth.js';
import { requireAccount } from './account-session.js';

/**
 * Operator routes accept either a signed-in account session (browser)
 * or the Scout API key (dashboard / automation).
 */
export function requireOperatorAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.accountId) {
    requireAccount(req, res, next);
    return;
  }
  requireApiKey(req, res, next);
}
