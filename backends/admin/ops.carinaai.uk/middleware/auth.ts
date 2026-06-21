import type { Request, Response, NextFunction } from 'express';
import { safeCallbackUrl } from '../lib/callback-url.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  const callbackUrl = safeCallbackUrl(req.originalUrl);
  const loginUrl = callbackUrl === '/'
    ? '/login'
    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  res.redirect(loginUrl);
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId && req.session?.role === 'superadmin') {
    next();
    return;
  }
  res.status(403).render('error', { title: 'Forbidden', message: 'Superadmin access required.' });
}

export function redirectIfAuthed(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    res.redirect(safeCallbackUrl(req.query.callbackUrl));
    return;
  }
  next();
}
