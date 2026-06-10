import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getUserProfile } from '../api/hosted-auth.js';
import { isHostedRequest } from './hosted-domain.js';

const PUBLIC_HOSTED_PATHS = new Set([
  '/hosted-login',
  '/hosted-register',
  '/app/auth/login',
  '/app/auth/register',
  '/api/auth/login',
  '/api/auth/register',
]);

export function isPublicHostedPath(path: string): boolean {
  return PUBLIC_HOSTED_PATHS.has(path);
}

export async function requireWebAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isHostedRequest(req.hostname)) {
    if (isPublicHostedPath(req.path)) {
      next();
      return;
    }
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      if (req.path.startsWith('/api/')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      res.redirect('/hosted-login');
      return;
    }
    const profile = await getUserProfile(accountId);
    if (!profile) {
      req.session.destroy(() => {
        if (req.path.startsWith('/api/')) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        res.redirect('/hosted-login');
      });
      return;
    }
    req.hostedUser = { id: accountId, email: profile.email, tier: profile.tier };
    next();
    return;
  }

  if (req.session?.webAuthed) {
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    const profile = await getUserProfile(req.session.hostedAccountId);
    if (profile) {
      req.hostedUser = {
        id: req.session.hostedAccountId,
        email: profile.email,
        tier: profile.tier,
      };
      next();
      return;
    }
  }
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.redirect('/login');
}

export function redirectIfWebAuthed(req: Request, res: Response, next: NextFunction): void {
  if (isHostedRequest(req.hostname)) {
    if (req.session?.hostedAccountId) {
      res.redirect('/');
      return;
    }
    next();
    return;
  }
  if (req.session?.webAuthed) {
    res.redirect('/');
    return;
  }
  next();
}

export function redirectIfHostedAuthed(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.hostedAccountId) {
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
