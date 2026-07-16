import type { ChatAccessInfo, ChatStreamChunk } from '@/api/types';

const TOOL_PATTERN = /\[using ([\w-]+)\.\.\.\]/g;

function parseChatAccess(value: unknown): ChatAccessInfo | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const access = value as Record<string, unknown>;
  if (
    access.mode !== 'platform'
    && access.mode !== 'byok'
    && access.mode !== 'mini'
  ) {
    return undefined;
  }
  if (
    typeof access.freeMessagesUsed !== 'number'
    || typeof access.freeMessagesLimit !== 'number'
    || typeof access.upgradeUrl !== 'string'
    || typeof access.byokUrl !== 'string'
  ) {
    return undefined;
  }
  return {
    mode: access.mode,
    freeMessagesUsed: access.freeMessagesUsed,
    freeMessagesLimit: access.freeMessagesLimit,
    upgradeUrl: access.upgradeUrl,
    byokUrl: access.byokUrl,
    ...(typeof access.provider === 'string' ? { provider: access.provider } : {}),
    ...(typeof access.model === 'string' ? { model: access.model } : {}),
  };
}

export function normalizeStreamPayload(payload: string): ChatStreamChunk & {
  sessionId?: string;
} {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'string') {
      return { content: parsed };
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as {
        content?: string;
        error?: string;
        sessionId?: string;
        access?: unknown;
        type?: string;
        meta?: { sessionId?: string };
      };
      if (record.error) return { error: record.error };
      const access = parseChatAccess(record.access);
      if (access) return { access };
      if (record.sessionId && !record.content && record.type !== 'text') {
        return { sessionId: record.sessionId };
      }
      if (record.meta?.sessionId) {
        return {
          sessionId: record.meta.sessionId,
          ...(record.content ? { content: record.content } : {}),
        };
      }
      if (record.content) return { content: record.content };
    }
  } catch {
    if (payload) return { content: payload };
  }
  return {};
}

export function extractToolNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(TOOL_PATTERN)) {
    const name = match[1];
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function stripToolMarkers(text: string): string {
  return text.replace(TOOL_PATTERN, '').replace(/\n{2,}/g, '\n').trim();
}
