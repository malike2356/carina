import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';
import { aivaAppOrigin } from '@/lib/product-surface';

export const dynamic = 'force-dynamic';

function publicOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
  if (host && !host.includes('localhost') && !host.startsWith('127.')) {
    return `${proto}://${host.split(',')[0]?.trim()}`;
  }
  return aivaAppOrigin();
}

function withOnboardingCookies(response: NextResponse) {
  response.cookies.set('aiva_onboarding_done', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  });
  response.cookies.set('aiva_signup_pending', '', { maxAge: 0, path: '/' });
  return response;
}

async function resolveResumeTarget(userId: string): Promise<'/aiva' | '/onboarding'> {
  const workspace = await getWorkspaceForUser(userId);
  return workspace?.onboardingCompletedAt ? '/aiva' : '/onboarding';
}

/** Restore onboarding cookies for returning users, then send them to Aiva. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  const redirectTo = await resolveResumeTarget(session.user.id);
  if (redirectTo === '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', origin));
  }

  return withOnboardingCookies(NextResponse.redirect(new URL('/aiva', origin)));
}

/** Same as GET but returns JSON so the login form can set cookies before navigating. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redirectTo = await resolveResumeTarget(session.user.id);
  if (redirectTo === '/onboarding') {
    return NextResponse.json({ ok: true, redirectTo });
  }

  return withOnboardingCookies(NextResponse.json({ ok: true, redirectTo }));
}
