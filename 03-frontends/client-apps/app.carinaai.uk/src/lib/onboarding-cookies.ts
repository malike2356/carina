import { NextResponse } from 'next/server';

export function applyOnboardingCompleteCookies(response: NextResponse): NextResponse {
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
