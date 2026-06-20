import type { Request, Response, NextFunction } from 'express';

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.session?.admin) {
    next();
    return;
  }
  res.redirect('/login');
}

export function redirectIfAuthed(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.session?.admin) {
    res.redirect('/');
    return;
  }
  next();
}
