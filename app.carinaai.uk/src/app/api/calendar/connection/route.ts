import { NextResponse } from 'next/server';
import {
  getWorkspaceCalendarConnection,
  toConnectionView,
  upsertCalendarConnection,
} from '@/lib/calendar-connection';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const connection = await getWorkspaceCalendarConnection(workspace.id);
  return NextResponse.json({
    data: connection ? toConnectionView(connection) : null,
    envConfigured: Boolean(
      process.env.CALDAV_URL && process.env.CALDAV_USERNAME && process.env.CALDAV_PASSWORD,
    ),
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    url?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  };

  const saved = await upsertCalendarConnection(workspace.id, body);
  return NextResponse.json({ data: toConnectionView(saved) });
}
