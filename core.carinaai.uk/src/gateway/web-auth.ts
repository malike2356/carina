import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

export function requireWebAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.webAuthed) {
    next();
    return;
  }
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.redirect('/login');
}

export function redirectIfWebAuthed(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.webAuthed) {
    res.redirect('/');
    return;
  }
  next();
}

export async function checkWebPassword(password: string): Promise<boolean> {
  const expected = process.env.CARINA_WEB_PASSWORD ?? '';
  if (!expected) return false;
  if (expected.startsWith('$2')) {
    return bcrypt.compare(password, expected);
  }
  return password === expected;
}
