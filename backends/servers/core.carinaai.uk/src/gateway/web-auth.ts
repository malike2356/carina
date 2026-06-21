import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getUserProfile } from '../api/hosted-auth.js';
import { isControlAuthorized, pairedDeviceFromRequest } from '../infrastructure/control-auth.js';
import { deviceHasScope } from '../infrastructure/device-scopes.js';
import { resolveProductMode } from '../product/surface.js';
import { canPerform, type RbacAction } from '../hosted/rbac.js';
import { requireOrgContext, type OrgContext } from '../hosted/org-context.js';

const OPS_API_PATHS = new Set([
  '/api/health',
  '/api/providers',
  '/api/config',
  '/api/ops/health',
]);

export function isOpsMachineApiPath(path: string, method: string): boolean {
  if (OPS_API_PATHS.has(path)) return true;
  if (path.startsWith('/api/ops/')) return true;
  if (path.startsWith('/api/security/')) return true;
  if (path.startsWith('/api/mcp')) return true;
  return path === '/api/chat/stream' && method === 'GET';
}

const PUBLIC_HOSTED_PATHS = new Set([
  '/hosted-login',
  '/hosted-register',
  '/app/auth/login',
  '/app/auth/register',
  '/api/cloud/auth/login',
  '/api/cloud/auth/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/gate-status',
  '/api/carina-ops/health',
  '/webhooks/telegram',
  '/health',
  '/favicon.ico',
  '/manifest.json',
  '/manifest.webmanifest',
  '/service-worker.js',
  '/chat-turn-lifecycle.js',
  '/i18n.js',
  '/mobile.js',
  '/notes.js',
  '/documents.js',
  '/images.js',
  '/email.js',
  '/calendar.js',
  '/scheduled.js',
  '/trello.js',
  '/workspace.js',
  '/marketplace.js',
  '/surfaces.js',
]);

export function isPublicHostedPath(path: string): boolean {
  if (PUBLIC_HOSTED_PATHS.has(path)) return true;
  if (
    path.endsWith('.js')
    || path.endsWith('.css')
    || path.endsWith('.svg')
    || path.endsWith('.json')
    || path.endsWith('.ico')
    || path.endsWith('.webmanifest')
  ) {
    return true;
  }
  return path.startsWith('/ops/assets/');
}

export async function requireWebAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicHostedPath(req.path)) {
    next();
    return;
  }

  const pairedDevice = pairedDeviceFromRequest(req);
  if (pairedDevice && req.path === '/api/chat' && req.method === 'POST' && deviceHasScope(pairedDevice, 'chat')) {
    next();
    return;
  }

  // Ops bearer must work on any host (127.0.0.1, docker internal, etc.) when HOSTED_MODE is on.
  if (isOpsMachineApiPath(req.path, req.method) && isControlAuthorized(req)) {
    next();
    return;
  }

  if (resolveProductMode(req.hostname) === 'hosted') {
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
  if (req.session?.webPendingTotp) {
    if (req.path === '/login/2fa' || req.path.startsWith('/api/auth/totp')) {
      next();
      return;
    }
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Two-factor verification required' });
      return;
    }
    res.redirect('/login/2fa');
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
  if (resolveProductMode(req.hostname) === 'hosted') {
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
  if (req.session?.webPendingTotp && req.path === '/login') {
    res.redirect('/login/2fa');
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

export function orgContext(req: Request): OrgContext {
  if (!req.orgContext) {
    throw new Error('Org context missing; use requireOrgMember middleware first');
  }
  return req.orgContext;
}

export async function requireHostedSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ctx = await requireOrgContext(req, res);
  if (!ctx) return;
  req.orgContext = ctx;
  next();
}

export function requireOrgMember(action: RbacAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = await requireOrgContext(req, res);
    if (!ctx) return;
    if (!canPerform(ctx.role, action)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    req.orgContext = ctx;
    next();
  };
}
