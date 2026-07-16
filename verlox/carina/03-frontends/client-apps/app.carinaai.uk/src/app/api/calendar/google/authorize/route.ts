import { NextResponse } from 'next/server';
import {
  getWorkspaceCalendarConnection,
  resolveGoogleOAuthClient,
  resolvePlatformGoogleClient,
  upsertCalendarConnection,
} from '@/lib/calendar-connection';
import { buildGoogleCalendarOAuthUrl } from '@/lib/google-calendar-client';
import { resolveOAuthSigningSecret, signGoogleOAuthState } from '@/lib/google-oauth-state';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

function appOrigin(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    new URL(request.url).origin
  );
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  const workspace = await requireWorkspace(session.user.id);
  const secret = resolveOAuthSigningSecret();
  if (!secret) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=OAuth%20signing%20secret%20missing', request.url),
    );
  }

  const url = new URL(request.url);
  const requestedClientId = url.searchParams.get('clientId')?.trim();

  let connection = await getWorkspaceCalendarConnection(workspace.id);
  if (requestedClientId) {
    connection = await upsertCalendarConnection(workspace.id, {
      provider: 'google',
      clientId: requestedClientId,
      enabled: true,
    });
  }

  const oauthClient = resolveGoogleOAuthClient(connection, workspace.id) ?? resolvePlatformGoogleClient();
  if (!oauthClient?.clientId) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=Google%20client%20ID%20required', request.url),
    );
  }

  const redirectUri = `${appOrigin(request)}/api/calendar/google/callback`;
  const state = signGoogleOAuthState(workspace.id, secret);
  const authUrl = buildGoogleCalendarOAuthUrl({
    clientId: oauthClient.clientId,
    redirectUri,
    state,
  });
  return NextResponse.redirect(authUrl);
}
