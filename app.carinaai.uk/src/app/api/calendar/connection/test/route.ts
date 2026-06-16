import { NextResponse } from 'next/server';
import { testCalDavConnection } from '@/lib/caldav-client';
import {
  getWorkspaceCalendarConnection,
  resolveConnectionCredentials,
  resolveEnvCalDavCredentials,
} from '@/lib/calendar-connection';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    url?: string;
    username?: string;
    password?: string;
  };

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
