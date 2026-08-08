import { NextResponse } from 'next/server';
import {
  getWorkspaceCalendarConnection,
  isCalendarConnectionConfigured,
  resolvePlatformGoogleClient,
  toConnectionView,
  upsertCalendarConnection,
} from '@/lib/calendar-connection';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const connection = await getWorkspaceCalendarConnection(workspace.id);
  const url = new URL(request.url);

  return NextResponse.json({
    data: connection ? toConnectionView(connection) : null,
    envConfigured: Boolean(
      process.env.CALDAV_URL && process.env.CALDAV_USERNAME && process.env.CALDAV_PASSWORD,
    ),
    platformGoogleConfigured: Boolean(await resolvePlatformGoogleClient()),
    oauth: {
      connected: url.searchParams.get('google') === 'connected',
      error: url.searchParams.get('google_error') ?? undefined,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    provider?: 'caldav' | 'google';
    url?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    calendarId?: string;
  };

  const saved = await upsertCalendarConnection(workspace.id, body);
  const view = toConnectionView(saved);
  if (!isCalendarConnectionConfigured(view)) {
    return NextResponse.json({
      data: view,
      warning: 'Connection saved but credentials are still incomplete.',
    });
  }
  return NextResponse.json({ data: view });
}
