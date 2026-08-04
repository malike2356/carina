import { NextResponse } from 'next/server';
import {
  getSessionHistoryPage,
  isChatSessionUuid,
} from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * Mobile-compatible history shape (matches core /api/chat/history/:sessionId).
 * Non-UUID / unknown sessions return an empty page instead of HTML 404, so
 * clients do not retry-storm the edge rate limiter.
 */
export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId: rawSessionId } = await context.params;
  const sessionId = String(rawSessionId ?? '').trim();
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const beforeRaw = String(url.searchParams.get('before') ?? '').trim();
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  if (beforeRaw && Number.isNaN(before?.getTime())) {
    return NextResponse.json({ error: 'before must be a valid ISO timestamp' }, { status: 400 });
  }

  const empty = {
    sessionId,
    messages: [] as Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt: string;
    }>,
    hasMore: false,
    oldestMessageId: null as string | null,
    newestMessageId: null as string | null,
  };

  if (!isChatSessionUuid(sessionId)) {
    return NextResponse.json(empty);
  }

  const workspace = await requireWorkspace(session.user.id);
  const { messages, hasMore } = await getSessionHistoryPage(sessionId, workspace.id, {
    limit,
    before,
  });

  const chatMessages = messages
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    }));

  return NextResponse.json({
    sessionId,
    messages: chatMessages,
    hasMore,
    oldestMessageId: chatMessages[0]?.id ?? null,
    newestMessageId: chatMessages[chatMessages.length - 1]?.id ?? null,
  });
}
