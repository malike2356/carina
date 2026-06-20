import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getPublicOrigin } from '@/lib/public-origin';

const protectedPrefixes = [
  '/dashboard',
  '/chat',
  '/library',
  '/research',
  '/tasks',
  '/documents',
  '/email',
  '/calendar',
  '/settings',
  '/billing',
  '/security',
];
const HUB_HOSTNAMES = new Set(['hub.carinaai.uk']);

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (HUB_HOSTNAMES.has(host)) {
    const url = request.nextUrl.clone();
    url.pathname = `/__hub-proxy${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  const { pathname } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/chat/:path*',
    '/library/:path*',
    '/research/:path*',
    '/tasks/:path*',
    '/documents/:path*',
    '/email/:path*',
    '/calendar/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/security/:path*',
    '/:path*',
  ],
};
