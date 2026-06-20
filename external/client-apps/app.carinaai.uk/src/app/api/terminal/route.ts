import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { canUseTerminal } from '@/lib/terminal-access';
import { logTerminalCommand } from '@/lib/terminal-audit';
import {
  appendTerminalCommand,
  createTerminalSession,
  deleteTerminalSession,
  getTerminalSession,
  listTerminalSessions,
} from '@/lib/terminal-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  if (!await canUseTerminal(workspace.id, session.user.id)) {
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

  if (!await canUseTerminal(workspace.id, session.user.id)) {
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

  const terminalSession = await appendTerminalCommand(workspace.id, body.sessionId, command, {
    userId: session.user.id,
    log: async (entry) => {
      await logTerminalCommand({
        workspaceId: workspace.id,
        userId: session.user.id,
        sessionId: body.sessionId!,
        command: entry.command,
        exitCode: entry.exitCode,
      });
    },
  });
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

  if (!await canUseTerminal(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Terminal not enabled for this workspace' }, { status: 403 });
  }
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') ?? '';
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const removed = deleteTerminalSession(workspace.id, sessionId);
  return NextResponse.json({ data: { removed } });
}
