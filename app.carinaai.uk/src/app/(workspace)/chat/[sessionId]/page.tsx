import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { getSessionMessages } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';
import { ChatView } from '@/components/chat/ChatView';
import type { ToolCall } from '@/components/chat/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ researchJob?: string; document?: string }>;
}

export default async function ChatPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const { researchJob, document: documentId } = await searchParams;
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);

  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)),
    )
    .limit(1);

  if (!chatSession) notFound();

  const messages = await getSessionMessages(sessionId, workspace.id);

  return (
    <ChatView
      sessionId={chatSession.id}
      sessionTitle={chatSession.title}
      initialMessages={messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: (m.toolCalls as ToolCall[] | null) ?? [],
          thinkingContent: m.thinkingContent ?? undefined,
          inputTokens: m.inputTokens,
          outputTokens: m.outputTokens,
          durationMs: m.durationMs,
          model: m.model,
          createdAt: m.createdAt.toISOString(),
        }))}
      workspacePlan={workspace.plan}
      researchJobId={researchJob ?? null}
      documentId={documentId ?? null}
    />
  );
}
