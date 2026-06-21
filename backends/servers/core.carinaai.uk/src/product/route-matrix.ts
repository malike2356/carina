import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { hostedAppOrigin } from './surface.js';
import { resolveProductMode, resolveProductSurface } from './surface.js';
import type { ProductMode, RouteOwnership } from './types.js';

const HOSTED_PREFIXES = [
  '/hosted-login',
  '/hosted-register',
  '/hosted-forgot',
  '/hosted-reset',
  '/billing',
  '/security',
  '/settings',
  '/dashboard',
  '/ops',
  '/api/cloud',
  '/api/auth',
  '/api/hosted',
  '/app/auth',
  '/webhooks/stripe',
];

const PRIVATE_PREFIXES = [
  '/login',
  '/control',
  '/api/ops',
];

const PRIVATE_EXACT = new Set<string>();

const SHARED_PREFIXES = [
  '/',
  '/chat',
  '/memory',
  '/notes',
  '/documents',
  '/images',
  '/calendar',
  '/scheduled',
  '/trello',
  '/compare',
  '/research',
  '/playbook',
  '/cookbook',
  '/packs',
  '/webhooks',
];

const PRIVATE_WORKSPACE_ONLY = ['/email', '/kanban', '/workspace', '/prompt-packs', '/trello'];

const OPS_BEARER_ANY_HOST = new Set([
  '/api/health',
  '/api/providers',
  '/api/config',
  '/logout',
]);

export function normalizeRoutePath(path: string): string {
  if (!path || path === '/') return '/';
  const withoutQuery = path.split('?')[0] ?? path;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix === '/') return path === '/' || path === '/chat';
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function classifyRoute(path: string): RouteOwnership {
  const normalised = normalizeRoutePath(path);

  if (
    normalised === '/logout'
    || normalised === '/api/health'
    || normalised === '/api/providers'
    || normalised === '/api/config'
    || normalised.startsWith('/api/chat')
    || normalised.startsWith('/api/memory')
    || normalised.startsWith('/api/documents')
    || normalised.startsWith('/api/images')
    || normalised.startsWith('/api/notes')
    || normalised.startsWith('/api/email')
    || normalised.startsWith('/api/calendar')
    || normalised.startsWith('/api/scheduled')
    || normalised.startsWith('/api/trello')
    || normalised.startsWith('/api/compare')
    || normalised.startsWith('/api/research')
    || normalised.startsWith('/api/playbook')
    || normalised.startsWith('/api/cookbook')
    || normalised.startsWith('/api/packs')
    || normalised.startsWith('/api/webhook')
    || normalised.startsWith('/api/kanban')
    || normalised.startsWith('/api/theme')
    || normalised.startsWith('/api/auth')
    || normalised.startsWith('/api/workspace')
    || normalised.startsWith('/api/web/context')
    || normalised.startsWith('/api/dashboard')
    || normalised.startsWith('/api/events')
    || normalised.startsWith('/api/sse')
    || normalised.startsWith('/api/stream')
    || normalised.startsWith('/api/tenant')
    || normalised.startsWith('/api/carina-ops')
    || normalised.startsWith('/webhooks/email')
    || normalised.startsWith('/manifest.json')
    || normalised.startsWith('/service-worker')
    || normalised.startsWith('/favicon.ico')
    || normalised.startsWith('/icon.svg')
    || normalised.endsWith('.js')
    || normalised.endsWith('.css')
    || normalised.endsWith('.svg')
    || normalised.endsWith('.json')
    || normalised.startsWith('/pricing')
    || normalised.startsWith('/checkout')
  ) {
    return 'any';
  }

  for (const prefix of HOSTED_PREFIXES) {
    if (matchesPrefix(normalised, prefix)) return 'hosted';
  }

  if (PRIVATE_EXACT.has(normalised)) return 'private';

  for (const prefix of PRIVATE_PREFIXES) {
    if (matchesPrefix(normalised, prefix)) return 'private';
  }

  for (const prefix of PRIVATE_WORKSPACE_ONLY) {
    if (matchesPrefix(normalised, prefix)) return 'private';
  }

  for (const prefix of SHARED_PREFIXES) {
    if (matchesPrefix(normalised, prefix)) return 'shared';
  }

  return 'any';
}

export function isRouteAllowedForMode(mode: ProductMode, path: string): boolean {
  const ownership = classifyRoute(path);
  if (ownership === 'any') return true;
  if (ownership === 'shared') return mode === 'hosted' || mode === 'private';
  if (ownership === 'hosted') return mode === 'hosted';
  if (ownership === 'private') return mode === 'private' || mode === 'ops';
  return true;
}

export type RouteDenial = {
  status: number;
  redirect?: string;
  body?: string;
};

export function routeDenialForMode(mode: ProductMode, path: string): RouteDenial | null {
  if (isRouteAllowedForMode(mode, path)) return null;

  const ownership = classifyRoute(path);
  const normalised = normalizeRoutePath(path);

  if (mode === 'private' && ownership === 'hosted') {
    const appOrigin = hostedAppOrigin();
    if (normalised.startsWith('/hosted-')) {
      return { status: 302, redirect: `${appOrigin}${normalised}` };
    }
    if (
      normalised === '/billing'
      || normalised === '/settings'
      || normalised === '/security'
      || normalised === '/dashboard'
      || normalised.startsWith('/ops')
    ) {
      return { status: 302, redirect: `${appOrigin}${normalised}` };
    }
    return { status: 404, body: 'Not found on private instance' };
  }

  if (mode === 'hosted' && ownership === 'private') {
    if (normalised === '/login' || normalised === '/logout') {
      return { status: 302, redirect: '/hosted-login' };
    }
    if (normalised.startsWith('/control')) {
      return { status: 404, body: 'Not found on Carina Cloud' };
    }
    if (normalised === '/email' || normalised === '/kanban' || normalised === '/workspace') {
      return { status: 404, body: 'Not found on Carina Cloud' };
    }
    return { status: 404, body: 'Not found on Carina Cloud' };
  }

  if (mode === 'hosted' && ownership === 'hosted' && normalised.startsWith('/api/ops')) {
    return { status: 404, body: 'Not found' };
  }

  if (mode === 'private' && ownership === 'hosted') {
    return { status: 404, body: 'Not found on private instance' };
  }

  return { status: 404, body: 'Not found' };
}

export function opsBearerAllowedOnAnyHost(path: string): boolean {
  const normalised = normalizeRoutePath(path);
  if (OPS_BEARER_ANY_HOST.has(normalised)) return true;
  return normalised.startsWith('/api/ops/');
}

export function enforceRouteOwnership(req: Request, res: Response, next: NextFunction): void {
  const mode = resolveProductMode(req.hostname);
  const path = normalizeRoutePath(req.path);

  if (mode === 'ops') {
    if (opsBearerAllowedOnAnyHost(path) || path.startsWith('/api/')) {
      next();
      return;
    }
    res.status(404).send(`Use ${config.product.opsUrl} for the operator console`);
    return;
  }

  const denial = routeDenialForMode(mode, path);
  if (!denial) {
    next();
    return;
  }

  if (denial.redirect) {
    res.redirect(denial.status, denial.redirect);
    return;
  }
  res.status(denial.status).send(denial.body ?? 'Not found');
}

export function surfaceForRequest(req: Request) {
  return resolveProductSurface(req.hostname);
}
