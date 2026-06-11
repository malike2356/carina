import type { Request, Response, NextFunction } from 'express';
import 'express-session';
import { config } from '../config/index.js';

declare module 'express-session' {
  interface SessionData {
    accountId?: string;
    lastSeenAt?: number;
  }
}

function isAccountApiRequest(req: Request): boolean {
  return req.path.startsWith('/api/') || req.originalUrl.includes('/account/api/');
}

function rejectUnauthenticated(req: Request, res: Response, expired = false): void {
  if (isAccountApiRequest(req)) {
    res.status(401).json({
      error: expired ? 'Session expired. Sign in again.' : 'Sign in required',
    });
    return;
  }
  res.redirect(expired ? '/account/login?expired=1' : '/account/login');
}

export function requireAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.accountId) {
    rejectUnauthenticated(req, res);
    return;
  }
  const now = Date.now();
  const lastSeenAt = req.session.lastSeenAt ?? now;
  if (now - lastSeenAt > config.auth.sessionTimeoutMs) {
    req.session.destroy(() => rejectUnauthenticated(req, res, true));
    return;
  }
  req.session.lastSeenAt = now;
  next();
}

export function redirectIfAccountAuthed(req: Request, res: Response, next: NextFunction): void {
  if (req.session.accountId) {
    res.redirect('/account');
    return;
  }
  next();
}
