import { type NextRequest, NextResponse } from 'next/server';
import {
  getWorkspaceCalendarConnection,
  isGoogleOAuthClientId,
  resolveGoogleOAuthClient,
  resolvePlatformGoogleClient,
  upsertCalendarConnection,
} from '@/lib/calendar-connection';
import { buildGoogleCalendarOAuthUrl } from '@/lib/google-calendar-client';
import { resolveOAuthSigningSecret, signGoogleOAuthState } from '@/lib/google-oauth-state';
import { getPublicOrigin } from '@/lib/public-origin';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', origin));

  const workspace = await requireWorkspace(session.user.id);
  const secret = resolveOAuthSigningSecret();
  if (!secret) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=OAuth%20signing%20secret%20missing', origin),
    );
  }

  const url = new URL(request.url);
  const requestedClientId = url.searchParams.get('clientId')?.trim();

  let connection = await getWorkspaceCalendarConnection(workspace.id);
  const platform = await resolvePlatformGoogleClient();

  if (requestedClientId && isGoogleOAuthClientId(requestedClientId)) {
    connection = await upsertCalendarConnection(workspace.id, {
      provider: 'google',
      clientId: requestedClientId,
      enabled: true,
    });
  } else if (
    // Invalid/empty BYOK (e.g. an email left in Advanced) or reconnect: use platform client.
    platform &&
    (connection?.username?.trim() || requestedClientId)
  ) {
    connection = await upsertCalendarConnection(workspace.id, {
      provider: 'google',
      clientId: '',
      enabled: true,
    });
  } else if (requestedClientId && !isGoogleOAuthClientId(requestedClientId) && !platform) {
    return NextResponse.redirect(
      new URL(
        '/settings/calendar?google_error=Google%20Client%20ID%20must%20end%20with%20.apps.googleusercontent.com',
        origin,
      ),
    );
  }

  const oauthClient = await resolveGoogleOAuthClient(connection, workspace.id);
  if (!oauthClient?.clientId) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=Google%20client%20ID%20required', origin),
    );
  }

  // Must match the host the user is on (app.carinaai.uk or admin.hireaiva.co.uk).
  // Preferring NEXT_PUBLIC_APP_URL alone breaks Connect on admin with Google unknownerror.
  const redirectUri = `${origin}/api/calendar/google/callback`;
  const state = signGoogleOAuthState(workspace.id, secret);
  const authUrl = buildGoogleCalendarOAuthUrl({
    clientId: oauthClient.clientId,
    redirectUri,
    state,
  });
  return NextResponse.redirect(authUrl);
}
