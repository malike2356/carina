import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { resolveAivaSignedInPath } from '@/lib/aiva-post-auth';
import { AIVA_PROVISION_INTENT_COOKIE, AIVA_PROVISION_DESCRIPTION_COOKIE } from '@/lib/aiva-role-provision-links';
import { applyOnboardingCompleteCookies } from '@/lib/onboarding-cookies';
import { TERMS_VERSION } from '@/lib/gdpr-constants';
import { seedSignupLegalAcceptances } from '@/lib/legal/signup-acceptance';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  const match = raw.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, '', { maxAge: 0, path: '/' });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);

  const signupTerms = readCookie(request, 'google_signup_terms') === '1';
  const loginMode = readCookie(request, 'google_auth_mode') === 'login';
  // Accept terms for any Google auth path (register sets the cookie explicitly;
  // login implies acceptance by using the service via Google).
  if (!session.user.termsAcceptedAt && (signupTerms || loginMode)) {
    await db
      .update(users)
      .set({
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
    if (workspace) {
      void seedSignupLegalAcceptances(session.user.id, workspace.id).catch(() => {});
    }
  }

  const subscribePending = readCookie(request, 'aiva_subscribe_pending') === '1';
  const signupPending = readCookie(request, 'aiva_signup_pending') === '1';
  const returnTo = readCookie(request, 'google_auth_return_to');
  const provisionDescription = readCookie(request, AIVA_PROVISION_DESCRIPTION_COOKIE);

  let redirectTo = returnTo && returnTo.startsWith('/') ? returnTo : '/launcher';

  if (returnTo?.startsWith('/aiva/provision?intent=provision')) {
    redirectTo = returnTo;
  } else if (signupPending || subscribePending || loginMode) {
    // One-step signup: always continue into trial / onboarding; never force a paid plan.
    redirectTo = resolveAivaSignedInPath({
      onboardingCompletedAt: workspace?.onboardingCompletedAt,
    });
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  // Only mark onboarding done when the workspace actually completed it.
  if (workspace?.onboardingCompletedAt) {
    applyOnboardingCompleteCookies(response);
  }
  clearCookie(response, 'aiva_subscribe_pending');
  clearCookie(response, 'aiva_signup_pending');
  clearCookie(response, 'google_signup_terms');
  clearCookie(response, 'google_auth_return_to');
  clearCookie(response, 'google_auth_mode');
  clearCookie(response, AIVA_PROVISION_INTENT_COOKIE);
  clearCookie(response, AIVA_PROVISION_DESCRIPTION_COOKIE);
  return response;
}
