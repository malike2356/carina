const TOOL_PATTERN = /\[using ([\w-]+)\.\.\.\]/g;

export function normalizeStreamPayload(payload: string): {
  content?: string;
  error?: string;
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
        type?: string;
        meta?: { sessionId?: string };
      };
      if (record.error) return { error: record.error };
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
