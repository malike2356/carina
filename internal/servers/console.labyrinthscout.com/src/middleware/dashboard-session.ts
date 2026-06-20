import type { NextFunction, Request, Response } from 'express';
import 'express-session';
import { config } from '../config/index.js';

declare module 'express-session' {
  interface SessionData {
    dashboardAuthed?: boolean;
    dashboardLastSeenAt?: number;
  }
}

function isDashboardApiRequest(req: Request): boolean {
  return req.path.startsWith('/dashboard/api/')
    || req.originalUrl.startsWith('/dashboard/api/');
}

function rejectUnauthenticated(req: Request, res: Response, expired = false): void {
  if (isDashboardApiRequest(req)) {
    res.status(401).json({
      error: expired ? 'Session expired. Sign in again.' : 'Sign in required',
    });
    return;
  }
  res.redirect(expired ? '/dashboard/login?expired=1' : '/dashboard/login');
}

export function requireDashboardSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.dashboardAuthed) {
    rejectUnauthenticated(req, res);
    return;
  }

  const now = Date.now();
  const lastSeenAt = req.session.dashboardLastSeenAt ?? now;
  if (now - lastSeenAt > config.auth.sessionTimeoutMs) {
    req.session.destroy(() => rejectUnauthenticated(req, res, true));
    return;
  }

  req.session.dashboardLastSeenAt = now;
  next();
}

export function redirectIfDashboardAuthed(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.session.dashboardAuthed) {
    res.redirect('/dashboard');
    return;
  }
  next();
}
