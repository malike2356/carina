import type { Request, Response, NextFunction } from 'express';
import 'express-session';
import { config } from '../config/index.js';

declare module 'express-session' {
  interface SessionData {
    accountId?: string;
    lastSeenAt?: number;
  }
}

export function requireAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.accountId) {
    res.redirect('/account/login');
    return;
  }
  const now = Date.now();
  const lastSeenAt = req.session.lastSeenAt ?? now;
  if (now - lastSeenAt > config.auth.sessionTimeoutMs) {
    req.session.destroy(() => res.redirect('/account/login?expired=1'));
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
