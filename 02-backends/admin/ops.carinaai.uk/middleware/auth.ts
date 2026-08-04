import type { Request, Response, NextFunction } from 'express';
import { safeCallbackUrl } from '../lib/callback-url.js';

function requestPath(req: Request): string {
  return (req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0] ?? req.path;
}

function isScoutProxyRequest(req: Request): boolean {
  return requestPath(req).startsWith('/scout-api');
}

function wantsStreamResponse(req: Request): boolean {
  const path = requestPath(req);
  return path === '/stream' || path.endsWith('/stream');
}

function wantsJsonResponse(req: Request): boolean {
  const accept = req.get('accept') ?? '';
  const contentType = req.get('content-type') ?? '';
  return (
    accept.includes('application/json') ||
    accept.includes('text/event-stream') ||
    contentType.includes('application/json')
  );
}

function wantsApiResponse(req: Request): boolean {
  return isScoutProxyRequest(req) || wantsJsonResponse(req) || wantsStreamResponse(req);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId || req.session?.adminToken) {
    next();
    return;
  }
  if (wantsStreamResponse(req)) {
    res.status(401);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(`data: ${JSON.stringify({ error: 'Session expired. Sign in again.' })}\n\n`);
    res.end();
    return;
  }
  if (wantsApiResponse(req) || req.path === '/health' || req.path.endsWith('/health')) {
    res.status(401).json({
      ok: false,
      error: 'Session expired. Refresh the page and sign in again.',
      code: 'session_expired',
    });
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
  if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
    res.status(403).json({ ok: false, error: 'Superadmin access required.' });
    return;
  }
  res.status(403).render('error', { title: 'Forbidden', message: 'Superadmin access required.' });
}

export function redirectIfAuthed(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId || req.session?.adminToken) {
    res.redirect(safeCallbackUrl(req.query.callbackUrl));
    return;
  }
  next();
}
