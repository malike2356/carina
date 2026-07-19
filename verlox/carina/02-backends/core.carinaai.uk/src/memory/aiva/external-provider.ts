/**
 * Optional external memory providers for Aiva (additive to built-in durable memory).
 * Uses existing Mem0 / Honcho backends when configured via env.
 *
 * Env:
 *   AIVA_EXTERNAL_MEMORY=off|mem0|honcho
 *   (plus the usual MEM0_* / HONCHO_* credentials)
 */

export type AivaExternalMemoryProvider = 'off' | 'mem0' | 'honcho';

export function resolveAivaExternalMemoryProvider(): AivaExternalMemoryProvider {
  const raw = (process.env.AIVA_EXTERNAL_MEMORY ?? 'off').trim().toLowerCase();
  if (raw === 'mem0' || raw === 'honcho') return raw;
  return 'off';
}

export async function prefetchExternalMemoryContext(opts: {
  workspaceId: string;
  workerId: string;
  contactId: string;
  query: string;
}): Promise<string> {
  const provider = resolveAivaExternalMemoryProvider();
  if (provider === 'off') return '';

  try {
    const { getAllMemoryBackends } = await import('../backends/index.js');
    const backend = getAllMemoryBackends().find((b) => b.name === provider);
    if (!backend?.isConfigured()) {
      return `\nExternal memory (${provider}): configured as active but credentials are missing.`;
    }
    const sessionKey = `aiva-ext:${opts.workspaceId}:${opts.workerId}:${opts.contactId}`;
    const results = await backend.searchMemory(opts.query || 'preferences', 5);
    if (!results.length) {
      return `\nExternal memory (${provider}): connected; no matching facts for this query yet.`;
    }
    const lines = results
      .slice(0, 5)
      .map((m) => `- ${(m.content ?? '').toString().slice(0, 240)}`)
      .filter((line) => line.length > 2);
    if (lines.length === 0) return '';
    return [
      '',
      `External memory prefetch (${provider}, additive):`,
      ...lines,
      `Session key: ${sessionKey}`,
    ].join('\n');
  } catch (err) {
    return `\nExternal memory (${provider}): unavailable (${err instanceof Error ? err.message : String(err)}).`;
  }
}

export async function syncTurnToExternalMemory(opts: {
  workspaceId: string;
  workerId: string;
  contactId: string;
  userMessage: string;
  assistantReply: string;
}): Promise<void> {
  const provider = resolveAivaExternalMemoryProvider();
  if (provider === 'off') return;
  try {
    const { getAllMemoryBackends } = await import('../backends/index.js');
    const backend = getAllMemoryBackends().find((b) => b.name === provider);
    if (!backend?.isConfigured()) return;
    const sessionKey = `aiva-ext:${opts.workspaceId}:${opts.workerId}:${opts.contactId}`;
    await backend.saveMemory(sessionKey, 'user', opts.userMessage.slice(0, 4000));
    if (opts.assistantReply.trim()) {
      await backend.saveMemory(sessionKey, 'assistant', opts.assistantReply.slice(0, 4000));
    }
  } catch {
    /* external sync is best-effort */
  }
}

export function describeExternalMemoryForStatus(): string {
  const provider = resolveAivaExternalMemoryProvider();
  if (provider === 'off') {
    return 'External memory: off (set AIVA_EXTERNAL_MEMORY=mem0|honcho to enable)';
  }
  return `External memory: ${provider} (additive; built-in USER/MEMORY still primary)`;
}
