import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, desc, and, lt, sql } from 'drizzle-orm';

const CHAT_SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isChatSessionUuid(value: unknown): value is string {
  return typeof value === 'string' && CHAT_SESSION_UUID_PATTERN.test(value);
}

export async function getOrCreateSession(
  workspaceId: string,
  sessionId: string | null,
): Promise<string> {
  if (isChatSessionUuid(sessionId)) {
    const existing = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspaceId)))
      .limit(1);
    if (existing.length > 0) return sessionId;
  }
  return createChatSession(workspaceId);
}

export async function createChatSession(
  workspaceId: string,
  options?: {
    title?: string;
    profileId?: string | null;
    provider?: string | null;
    model?: string | null;
  },
): Promise<string> {
  const [created] = await db
    .insert(chatSessions)
    .values({
      workspaceId,
      title: options?.title ?? 'New chat',
      profileId: options?.profileId ?? null,
      provider: options?.provider?.trim() || '',
      model: options?.model?.trim() || '',
    })
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

export async function getSessionHistoryPage(
  sessionId: string,
  workspaceId: string,
  options: { limit?: number; before?: Date } = {},
) {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 200);
  const conditions = [
    eq(chatMessages.sessionId, sessionId),
    eq(chatMessages.workspaceId, workspaceId),
  ];
  if (options.before) conditions.push(lt(chatMessages.createdAt, options.before));

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  return {
    messages: rows.slice(0, limit).reverse(),
    hasMore,
  };
}

export async function listSessions(workspaceId: string, limit = 50) {
  const lastActivity = sql<Date>`coalesce(${chatSessions.lastMessageAt}, max(${chatMessages.createdAt}))`;
  return db
    .select({
      id: chatSessions.id,
      workspaceId: chatSessions.workspaceId,
      title: chatSessions.title,
      model: chatSessions.model,
      provider: chatSessions.provider,
      mode: chatSessions.mode,
      pinned: chatSessions.pinned,
      archived: chatSessions.archived,
      lastMessageAt: lastActivity,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .innerJoin(
      chatMessages,
      and(
        eq(chatMessages.sessionId, chatSessions.id),
        eq(chatMessages.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(chatSessions.workspaceId, workspaceId),
        eq(chatSessions.archived, false),
      ),
    )
    .groupBy(chatSessions.id)
    .orderBy(desc(lastActivity))
    .limit(limit);
}

export async function autoTitleSession(sessionId: string, firstUserMessage: string): Promise<void> {
  const title = firstUserMessage.slice(0, 60).trim() || 'New chat';
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
