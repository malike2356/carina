import { NextResponse } from 'next/server';
import { testCalDavConnection } from '@/lib/caldav-client';
import {
  getWorkspaceCalendarConnection,
  isGoogleOAuthClientId,
  resolveConnectionCredentials,
  resolveEnvCalDavCredentials,
  resolveGoogleConnectionCredentials,
  resolvePlatformGoogleClient,
} from '@/lib/calendar-connection';
import { testGoogleCalendarConnection } from '@/lib/google-calendar-client';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    provider?: 'caldav' | 'google';
    url?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    calendarId?: string;
  };

  if (body.provider === 'google') {
    const connection = await getWorkspaceCalendarConnection(workspace.id);
    const stored = connection?.provider === 'google'
      ? await resolveGoogleConnectionCredentials(connection, workspace.id)
      : null;
    const platform = await resolvePlatformGoogleClient();

    const requestedClientId = body.clientId?.trim() || '';
    // Ignore emails / junk in the Advanced Client ID field; only real Google client IDs are BYOK.
    const byokClientId = isGoogleOAuthClientId(requestedClientId) ? requestedClientId : '';
    const usingByok = Boolean(byokClientId);

    const creds = {
      clientId: byokClientId || stored?.clientId || platform?.clientId || '',
      // Platform path: ignore Advanced secret/token fields (users often paste junk there).
      clientSecret: usingByok
        ? (body.clientSecret?.trim() || stored?.clientSecret || '')
        : (stored?.clientSecret || platform?.clientSecret || ''),
      refreshToken: usingByok
        ? (body.refreshToken?.trim() || stored?.refreshToken || '')
        : (stored?.refreshToken || body.refreshToken?.trim() || ''),
      calendarId: body.calendarId?.trim() || stored?.calendarId || 'primary',
    };

    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
      return NextResponse.json(
        {
          error:
            requestedClientId && !byokClientId
              ? 'OAuth Client ID must end with .apps.googleusercontent.com (or leave Advanced blank to use platform OAuth)'
              : 'Google client ID, secret, and refresh token are required. Click Connect with Google first.',
        },
        { status: 400 },
      );
    }

    const result = await testGoogleCalendarConnection(creds);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      data: {
        ok: true,
        calendarId: result.calendarId,
        eventCount: result.eventCount,
      },
    });
  }

  const connection = await getWorkspaceCalendarConnection(workspace.id);
  const creds =
    body.url && body.username && body.password
      ? {
          url: body.url.trim(),
          username: body.username.trim(),
          password: body.password,
        }
      : (connection ? resolveConnectionCredentials(connection, workspace.id) : null) ??
        resolveEnvCalDavCredentials();

  if (!creds) {
    return NextResponse.json({ error: 'CalDAV credentials required' }, { status: 400 });
  }

  const result = await testCalDavConnection(creds);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Connection failed' }, { status: 502 });
  }

  return NextResponse.json({ data: { ok: true, calendarUrl: result.calendarUrl } });
}
