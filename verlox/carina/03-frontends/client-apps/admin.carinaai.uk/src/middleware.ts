import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_BASE_PATH, OPS_BUSINESS_SHELL_PREFIX } from '@/lib/admin-base-path';
import {
  adminSessionOptions,
  getAdminSessionFromRequest,
  isValidAdminSession,
} from '@/lib/admin-session';
import { isOpsProxyRequest, sessionFromOpsProxy } from '@/lib/ops-proxy-auth';

const OPS_LOGIN_URL = (process.env.OPS_CONSOLE_URL ?? 'https://ops.carinaai.uk').replace(/\/$/, '');

const PUBLIC_PATHS = new Set(['/login', `${ADMIN_BASE_PATH}/login`]);

function stripBasePath(pathname: string): string {
  if (pathname === ADMIN_BASE_PATH) return '/';
  if (pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return pathname.slice(ADMIN_BASE_PATH.length) || '/';
  }
  return pathname;
}

function isPublicApi(pathname: string): boolean {
  const path = stripBasePath(pathname);
  return path === '/api/auth/login'
    || path === '/api/auth/logout'
    || path === '/api/health';
}

function isProtectedPage(pathname: string): boolean {
  const path = stripBasePath(pathname);
  if (PUBLIC_PATHS.has(path)) return false;
  const adminRoutes = [
    '/customers',
    '/fleet',
    '/va-queue',
    '/revenue',
    '/audit-log',
    '/partners',
    '/marketplace',
  ];
  return adminRoutes.some((route) => path === route || path.startsWith(`${route}/`))
    || path === '/';
}

function isProtectedApi(pathname: string): boolean {
  const path = stripBasePath(pathname);
  return path.startsWith('/api/admin/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next')
    || pathname.startsWith('/favicon')
    || pathname.includes('/_next/')
  ) {
    return NextResponse.next();
  }

  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = isProtectedPage(pathname) || isProtectedApi(pathname);
  if (!needsAuth) {
    return NextResponse.next();
  }

  if (isOpsProxyRequest(request.headers)) {
    const proxied = sessionFromOpsProxy(request.headers);
    if (proxied) {
      return NextResponse.next();
    }
  }

  const response = NextResponse.next();
  const session = await getAdminSessionFromRequest(request, response);

  if (!isValidAdminSession(session)) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const shellPath = `${OPS_BUSINESS_SHELL_PREFIX}${stripBasePath(pathname)}`;
    const loginUrl = new URL(`${OPS_LOGIN_URL}/login`);
    loginUrl.searchParams.set('callbackUrl', shellPath);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/business-inner',
    '/business-inner/:path*',
  ],
};
