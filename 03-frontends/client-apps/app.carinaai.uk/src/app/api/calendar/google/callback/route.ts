import { NextResponse } from 'next/server';
import {
  getWorkspaceCalendarConnection,
  resolveGoogleOAuthClient,
  saveGoogleOAuthTokens,
} from '@/lib/calendar-connection';
import { exchangeGoogleOAuthCode } from '@/lib/google-calendar-client';
import { resolveOAuthSigningSecret, verifyGoogleOAuthState } from '@/lib/google-oauth-state';

export const dynamic = 'force-dynamic';

function appOrigin(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    new URL(request.url).origin
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings/calendar?google_error=${encodeURIComponent(oauthError)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=Missing%20OAuth%20code', request.url),
    );
  }

  const secret = resolveOAuthSigningSecret();
  if (!secret) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=OAuth%20signing%20secret%20missing', request.url),
    );
  }

  const parsed = verifyGoogleOAuthState(state, secret);
  if (!parsed) {
    return NextResponse.redirect(
      new URL('/settings/calendar?google_error=Invalid%20OAuth%20state', request.url),
    );
  }

  const connection = await getWorkspaceCalendarConnection(parsed.workspaceId);
  const oauthClient = resolveGoogleOAuthClient(connection, parsed.workspaceId);
  if (!oauthClient) {
    return NextResponse.redirect(
      new URL(
        '/settings/calendar?google_error=Save%20your%20Google%20client%20ID%20and%20secret%20before%20connecting',
        request.url,
      ),
    );
  }

  try {
    const redirectUri = `${appOrigin(request)}/api/calendar/google/callback`;
    const tokens = await exchangeGoogleOAuthCode({
      clientId: oauthClient.clientId,
      clientSecret: oauthClient.clientSecret,
      code,
      redirectUri,
    });

    await saveGoogleOAuthTokens(parsed.workspaceId, {
      clientId: oauthClient.clientId,
      clientSecret: oauthClient.clientSecret,
      refreshToken: tokens.refreshToken,
      calendarId: connection?.url?.trim() || 'primary',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google OAuth failed';
    return NextResponse.redirect(
      new URL(`/settings/calendar?google_error=${encodeURIComponent(message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL('/settings/calendar?google=connected', request.url));
}
