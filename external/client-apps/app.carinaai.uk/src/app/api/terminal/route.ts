import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  appendTerminalCommand,
  createTerminalSession,
  deleteTerminalSession,
  getTerminalSession,
  listTerminalSessions,
} from '@/lib/terminal-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireTerminalAccess(workspaceId: string): Promise<boolean> {
  const rows = await db
    .select({ terminalEnabled: workspaceSettings.terminalEnabled })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  return rows[0]?.terminalEnabled === true;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  if (!await requireTerminalAccess(workspace.id)) {
    return NextResponse.json({ error: 'Terminal not enabled for this workspace' }, { status: 403 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') ?? '';

  if (!sessionId) {
    return NextResponse.json({
      data: {
        session: null,
        sessions: listTerminalSessions(workspace.id),
      },
    });
  }

  const terminalSession = getTerminalSession(workspace.id, sessionId);
  if (!terminalSession) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      session: terminalSession,
      sessions: listTerminalSessions(workspace.id),
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  if (!await requireTerminalAccess(workspace.id)) {
    return NextResponse.json({ error: 'Terminal not enabled for this workspace' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({})) as {
    sessionId?: string;
    command?: string;
    cwd?: string;
    action?: 'create' | 'run';
  };

  if (body.action === 'create' || !body.sessionId) {
    const terminalSession = createTerminalSession(workspace.id);
    return NextResponse.json({
      data: {
        session: terminalSession,
        sessions: listTerminalSessions(workspace.id),
      },
    });
  }

  const command = String(body.command ?? '').trim();
  if (!command) {
    return NextResponse.json({ error: 'command is required' }, { status: 400 });
  }

  const terminalSession = await appendTerminalCommand(workspace.id, body.sessionId, command);
  if (!terminalSession) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      session: terminalSession,
      sessions: listTerminalSessions(workspace.id),
    },
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  if (!await requireTerminalAccess(workspace.id)) {
    return NextResponse.json({ error: 'Terminal not enabled for this workspace' }, { status: 403 });
  }
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') ?? '';
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const removed = deleteTerminalSession(workspace.id, sessionId);
  return NextResponse.json({ data: { removed } });
}
