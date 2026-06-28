import { NextRequest, NextResponse } from 'next/server';
import {
  adminSessionOptions,
  getAdminSessionFromRequest,
  isValidAdminSession,
} from '@/lib/admin-session';

const PUBLIC_PATHS = new Set(['/login']);

function isPublicApi(pathname: string): boolean {
  return pathname === '/api/auth/login'
    || pathname === '/api/auth/logout'
    || pathname === '/api/health';
}

function isProtectedPage(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return false;
  const adminRoutes = ['/customers', '/fleet', '/va-queue', '/revenue', '/audit-log'];
  return adminRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
    || pathname === '/';
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith('/api/admin/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = isProtectedPage(pathname) || isProtectedApi(pathname);
  if (!needsAuth) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getAdminSessionFromRequest(request, response);

  if (!isValidAdminSession(session)) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/api/health',
    '/customers/:path*',
    '/fleet/:path*',
    '/va-queue/:path*',
    '/revenue/:path*',
    '/audit-log/:path*',
    '/api/admin/:path*',
    '/api/auth/:path*',
  ],
};
