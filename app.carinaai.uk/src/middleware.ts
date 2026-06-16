import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const protectedPrefixes = ['/dashboard', '/settings', '/billing', '/security'];
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/billing/:path*', '/security/:path*', '/:path*'],
};
