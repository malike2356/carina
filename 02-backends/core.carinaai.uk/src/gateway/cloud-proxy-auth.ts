import type { NextFunction, Request, Response } from 'express';
import { authorizeOps } from '../ops/ops-auth.js';
import { opsToken } from '../ops/ops-config.js';

function scoutOpsAuthorized(req: Request): boolean {
  const expected = process.env.SCOUT_OPS_TOKEN?.trim() ?? '';
  if (!expected) return false;
  const token = req.headers['x-scout-token'];
  const provided = Array.isArray(token) ? token[0] : token;
  return typeof provided === 'string' && provided === expected;
}

/** True when the caller is app.carinaai.uk (ops token) or Scout ops analytics. */
export function isCloudProxyAuthorized(req: Request): boolean {
  if (authorizeOps(req)) return true;
  return scoutOpsAuthorized(req);
}

/** Tenant APIs proxied from app.carinaai.uk (ops bearer, not browser session). */
export function isCloudProxyApiPath(path: string): boolean {
  if (path.startsWith('/api/conversations')) return true;
  if (path.startsWith('/api/workspace')) return true;
  if (path.startsWith('/api/analytics')) return true;
  if (path.startsWith('/api/channels/webhook/')) return false;
  if (path.startsWith('/api/channels')) return true;
  if (path.startsWith('/api/aiva/webhooks/')) return false;
  if (path.startsWith('/api/aiva/') || path === '/api/aiva') return true;
  if (path.startsWith('/api/trello')) return true;
  return false;
}

/**
 * Restrict tenant Aiva APIs to trusted proxies (cloud app, Scout).
 * In non-production, allows unauthenticated access only when no ops token is configured
 * so local `pnpm dev` keeps working without secrets.
 */
export function requireCloudProxy(req: Request, res: Response, next: NextFunction): void {
  if (isCloudProxyAuthorized(req)) {
    next();
    return;
  }

  const configured = Boolean(opsToken());
  if (!configured && process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}
