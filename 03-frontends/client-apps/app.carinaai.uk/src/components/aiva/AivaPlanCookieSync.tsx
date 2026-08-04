import { cookies } from 'next/headers';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { coreProxyEnabled } from '@/lib/core-proxy';

/** Syncs aiva_plan_status cookie for middleware plan gates; only mounted under /aiva layout. */
export async function AivaPlanCookieSync() {
  if (!coreProxyEnabled()) return null;

  const session = await getSession();
  if (!session) return null;

  try {
    const workspace = await requireWorkspace(session.user.id);
    const res = await proxyAivaRequest(workspace.id, '/api/aiva/subscription/status');
    if (!res.ok) return null;

    const status = (await res.json()) as {
      status?: string;
      trialDaysRemaining?: number | null;
      softWall?: boolean;
      prepaidActive?: boolean;
      prepaidRemainingMessages?: number;
    };
    const cookieStore = await cookies();
    let planCookie = String(status.status ?? 'trialing');
    if (status.prepaidActive || (status.prepaidRemainingMessages ?? 0) > 0) {
      planCookie = 'prepaid';
    } else if (planCookie === 'trial_ended' || status.softWall) {
      planCookie = 'trial_ended';
    } else if (
      status.trialDaysRemaining !== null
      && status.trialDaysRemaining !== undefined
      && status.trialDaysRemaining <= 0
      && (planCookie === 'trialing' || planCookie === 'trial')
    ) {
      planCookie = 'trial_ended';
    }
    cookieStore.set('aiva_plan_status', planCookie, {
      httpOnly: true,
      maxAge: 3600,
      path: '/',
      sameSite: 'lax',
    });
  } catch {
    // optional for Aiva routes
  }

  return null;
}
