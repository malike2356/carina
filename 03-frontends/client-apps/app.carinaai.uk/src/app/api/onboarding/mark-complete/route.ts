import { NextResponse } from 'next/server';
import { applyOnboardingCompleteCookies } from '@/lib/onboarding-cookies';
import { requireSession } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

/** Sets aiva_onboarding_done cookie after the client has marked DB onboarding complete. */
export async function POST() {
  try {
    await requireSession();
    return applyOnboardingCompleteCookies(NextResponse.json({ ok: true }));
  } catch (err) {
    return respondAuthError(err);
  }
}
