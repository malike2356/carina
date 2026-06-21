import type { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    next();
    return;
  }
  res.redirect('/login');
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
    res.redirect('/');
    return;
  }
  next();
}
