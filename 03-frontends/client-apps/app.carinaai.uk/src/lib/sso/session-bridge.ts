import { NextResponse } from 'next/server';
import { makeSignature } from 'better-auth/crypto';
import { auth } from '@/lib/auth';

export async function redirectWithAuthSession(userId: string, redirectPath: string): Promise<NextResponse> {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.findUserById(userId);
  if (!user) {
    return NextResponse.redirect(new URL('/login?error=sso_session', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100'));
  }

  const session = await ctx.internalAdapter.createSession(userId);
  const signedToken = `${session.token}.${await makeSignature(session.token, ctx.secret)}`;
  const cookieName = ctx.authCookies.sessionToken.name;
  const cookieAttrs = ctx.authCookies.sessionToken.attributes;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4100';
  const safePath = redirectPath.startsWith('/') ? redirectPath : '/launcher';

  const response = NextResponse.redirect(new URL(safePath, appUrl));
  response.cookies.set(cookieName, signedToken, {
    httpOnly: cookieAttrs.httpOnly ?? true,
    secure: cookieAttrs.secure ?? process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: cookieAttrs.path ?? '/',
    maxAge: ctx.sessionConfig.expiresIn,
    ...(cookieAttrs.domain ? { domain: cookieAttrs.domain } : {}),
  });

  return response;
}
