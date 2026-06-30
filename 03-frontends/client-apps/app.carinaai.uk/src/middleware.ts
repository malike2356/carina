import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getPublicOrigin } from '@/lib/public-origin';
import {
  isAivaProductHost,
  isCloudCanonicalHost,
  isCloudOnlyRoute,
} from '@/lib/product-surface';
import { AIVA_POST_AUTH_PATH } from '@/lib/aiva-post-auth';
import { isLegalExemptApiPath } from '@/lib/legal/legal-gate-paths';

const protectedPrefixes = [
  '/dashboard',
  '/chat',
  '/library',
  '/support',
  '/research',
  '/tasks',
  '/documents',
  '/email',
  '/calendar',
  '/settings',
  '/billing',
  '/security',
  '/aiva',
  '/conversations',
  '/onboarding',
];

const workspaceRoutePrefixes = [
  '/launcher',
  '/dashboard',
  '/chat',
  '/library',
  '/support',
  '/research',
  '/tasks',
  '/documents',
  '/email',
  '/calendar',
  '/settings',
  '/billing',
  '/security',
  '/aiva',
  '/conversations',
  '/files',
  '/cron',
  '/scheduled',
  '/terminal',
  '/mcp',
  '/webhooks',
  '/env',
  '/system',
  '/analytics',
  '/logs',
  '/profiles',
  '/packs',
  '/channels',
  '/trello',
  '/slack',
];

const HUB_HOSTNAMES = new Set(['hub.carinaai.uk']);

function requestHostname(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-host');
  const host = (forwarded ?? request.headers.get('host') ?? '').split(',')[0]?.trim();
  return host.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
}

function isWorkspaceRoute(pathname: string): boolean {
  return workspaceRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function withProductSurfaceHeader(response: NextResponse, aivaHost: boolean): NextResponse {
  if (aivaHost) {
    response.headers.set('x-carina-product-surface', 'aiva');
  }
  return response;
}

async function applyLegalApiGate(
  request: NextRequest,
  pathname: string,
  sessionCookie: string | undefined,
): Promise<NextResponse | null> {
  if (!sessionCookie || !pathname.startsWith('/api/') || isLegalExemptApiPath(pathname)) {
    return null;
  }

  try {
    const statusUrl = new URL('/api/legal/status', request.url);
    const res = await fetch(statusUrl, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { all_current_accepted?: boolean; pending?: unknown[] };
    if (data.all_current_accepted) return null;
    return NextResponse.json(
      { code: 'legal_acceptance_required', pending: data.pending ?? [] },
      { status: 403 },
    );
  } catch {
    return null;
  }
}

function applyAivaPlanGate(request: NextRequest, pathname: string): NextResponse | null {
  const isAivaPage = pathname.startsWith('/aiva');
  const isAivaApi =
    pathname.startsWith('/api/aiva') && !pathname.includes('/webhooks');
  if (!isAivaPage && !isAivaApi) return null;

  const planStatus = request.cookies.get('aiva_plan_status')?.value;
  if (planStatus !== 'suspended' && planStatus !== 'trial_expired') return null;

  if (isAivaApi) {
    return NextResponse.json(
      { error: 'aiva_suspended', upgradeUrl: '/billing/aiva' },
      { status: 402 },
    );
  }

  const billingUrl = new URL('/billing/aiva', request.url);
  billingUrl.searchParams.set('reason', planStatus === 'trial_expired' ? 'trial_expired' : 'suspended');
  return NextResponse.redirect(billingUrl);
}

export async function middleware(request: NextRequest) {
  const hostname = requestHostname(request);
  const aivaHost = isAivaProductHost(hostname);
  const hostHeader = request.headers.get('host') ?? '';

  if (HUB_HOSTNAMES.has(hostHeader)) {
    const url = request.nextUrl.clone();
    url.pathname = `/__hub-proxy${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  const { pathname, searchParams } = request.nextUrl;

  if (
    isCloudCanonicalHost(hostname)
    && pathname === '/register'
    && searchParams.get('from') === 'aiva'
  ) {
    return NextResponse.redirect(new URL('/register', request.url), 301);
  }

  if (aivaHost) {
    if (pathname === '/') {
      const sessionCookie = getSessionCookie(request);
      const dest = sessionCookie ? AIVA_POST_AUTH_PATH : '/register';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (pathname === '/billing') {
      return NextResponse.redirect(new URL('/billing/aiva', request.url));
    }
    if (isCloudOnlyRoute(pathname)) {
      return NextResponse.redirect(new URL('/aiva/workers', request.url));
    }
  }

  if (pathname.startsWith('/api/terminal') && request.headers.get('x-carina-operator-token')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sessionCookie = getSessionCookie(request);
  if (sessionCookie) {
    const legalGate = await applyLegalApiGate(request, pathname, sessionCookie);
    if (legalGate) {
      return withProductSurfaceHeader(legalGate, aivaHost);
    }

    const planGate = applyAivaPlanGate(request, pathname);
    if (planGate) {
      return withProductSurfaceHeader(planGate, aivaHost);
    }
  }

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))
    || pathname.startsWith('/terminal')
    || pathname.startsWith('/launcher');

  if (!needsAuth) {
    return withProductSurfaceHeader(NextResponse.next(), aivaHost);
  }

  if (!sessionCookie) {
    const loginUrl = new URL('/login', getPublicOrigin(request));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const onboardingDone = request.cookies.get('aiva_onboarding_done')?.value;
  const signupPending = request.cookies.get('aiva_signup_pending')?.value;

  if (
    (aivaHost || signupPending)
    && !onboardingDone
    && isWorkspaceRoute(pathname)
    && !pathname.startsWith('/onboarding')
  ) {
    return NextResponse.redirect(new URL(AIVA_POST_AUTH_PATH, request.url));
  }

  return withProductSurfaceHeader(NextResponse.next(), aivaHost);
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
    '/aiva/:path*',
    '/conversations/:path*',
    '/onboarding/:path*',
    '/((?!themes/|_next/|favicon\\.svg|manifest\\.webmanifest|sw\\.js).*)',
  ],
};
