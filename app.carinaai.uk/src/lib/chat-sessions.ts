import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function getOrCreateSession(
  workspaceId: string,
  sessionId: string | null,
): Promise<string> {
  if (sessionId) {
    const existing = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspaceId)))
      .limit(1);
    if (existing.length > 0) return sessionId;
  }
  const [created] = await db
    .insert(chatSessions)
    .values({ workspaceId, title: 'New chat' })
    .returning({ id: chatSessions.id });
  return created.id;
}

export async function saveMessage(params: {
  sessionId: string;
  workspaceId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown[];
  thinkingContent?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
}): Promise<void> {
  await db.insert(chatMessages).values({
    sessionId: params.sessionId,
    workspaceId: params.workspaceId,
    role: params.role,
    content: params.content,
    toolCalls: params.toolCalls && params.toolCalls.length > 0 ? params.toolCalls : null,
    thinkingContent: params.thinkingContent ?? null,
    inputTokens: params.inputTokens ?? 0,
    outputTokens: params.outputTokens ?? 0,
    durationMs: params.durationMs ?? 0,
    model: params.model ?? '',
  });
  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));
}

export async function getSessionMessages(sessionId: string, workspaceId: string) {
  return db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.workspaceId, workspaceId),
      ),
    )
    .orderBy(chatMessages.createdAt);
}

export async function listSessions(workspaceId: string, limit = 50) {
  return db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.workspaceId, workspaceId),
        eq(chatSessions.archived, false),
      ),
    )
    .orderBy(desc(chatSessions.lastMessageAt))
    .limit(limit);
}

export async function autoTitleSession(sessionId: string, firstUserMessage: string): Promise<void> {
  const title = firstUserMessage.slice(0, 60).trim() || 'New chat';
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
