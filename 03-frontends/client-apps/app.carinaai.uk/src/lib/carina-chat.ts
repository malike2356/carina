import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, workspaceSkills } from '@/db/schema';
import { getWorkspaceBrainSettings } from '@/lib/brain-settings';
import { ChatStreamError } from '@/lib/chat-errors';
import { buildCloudSystemPrompt } from '@/lib/cloud-identity';
import { coreProxyEnabled, requiresWorkspaceByokKeys, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { sanitizeCarinaProse } from '@/lib/writing-style';
import { getWorkspaceProfile } from '@/lib/workspace-profiles';

const PROVIDER_ENDPOINTS: Record<string, { url: string; model: string }> = {
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'deepseek/deepseek-chat' },
  together: { url: 'https://api.together.xyz/v1/chat/completions', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
};

export type CarinaChatStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; id: string; name: string; input: unknown }
  | { type: 'tool_done'; id: string; output: unknown; durationMs: number }
  | { type: 'tool_error'; id: string; error: string; durationMs: number };

function resolveProvider(
  keys: Array<{ provider: string; apiKey: string }>,
  providerOverride?: string,
  modelOverride?: string,
) {
  const preferred =
    (providerOverride ? keys.find((key) => key.provider === providerOverride) : null) ??
    keys.find((key) => key.provider === 'deepseek') ??
    keys[0];
  const config = PROVIDER_ENDPOINTS[preferred.provider];
  if (!config) {
    throw new Error(`Provider ${preferred.provider} is not supported for cloud chat yet.`);
  }
  return { ...preferred, ...config, model: modelOverride || config.model };
}

async function* streamOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  message: string,
  systemPrompt: string,
): AsyncGenerator<CarinaChatStreamEvent> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new ChatStreamError(text || `Provider request failed (${res.status})`, 'PROVIDER_ERROR');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield { type: 'text', content: sanitizeCarinaProse(delta) };
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export function normalizeCoreEvent(parsed: unknown): CarinaChatStreamEvent | null {
  if (typeof parsed === 'string') {
    return { type: 'text', content: parsed };
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const event = parsed as Record<string, unknown>;
  const eventType = typeof event.type === 'string' ? event.type : '';
  if (eventType === 'status' || eventType === 'meta' || eventType === 'done') {
    return null;
  }
  if (eventType === 'error') {
    throw new ChatStreamError(String(event.error ?? event.content ?? 'Chat failed'), 'CHAT_FAILED');
  }
  if (eventType === 'tool_start') {
    return {
      type: 'tool_start',
      id: String(event.id ?? crypto.randomUUID()),
      name: String(event.name ?? 'tool'),
      input: event.input ?? {},
    };
  }

  if (event.type === 'tool_result') {
    return {
      type: 'tool_done',
      id: String(event.id ?? ''),
      output: event.output,
      durationMs: Number(event.duration_ms ?? event.durationMs ?? 0),
    };
  }

  if (event.type === 'tool_error') {
    return {
      type: 'tool_error',
      id: String(event.id ?? ''),
      error: String(event.error ?? 'Tool failed'),
      durationMs: Number(event.duration_ms ?? event.durationMs ?? 0),
    };
  }

  if (typeof event.error === 'string') {
    throw new Error(event.error);
  }

  // 'tool' type events are internal status markers (e.g. "[using web-search...]").
  // They must not be surfaced as chat text. Drop them silently.
  if (event.type === 'tool') {
    return null;
  }

  if (typeof event.content === 'string') {
    return { type: 'text', content: sanitizeCarinaProse(event.content) };
  }

  if (typeof event.delta === 'string') {
    return { type: 'text', content: sanitizeCarinaProse(event.delta) };
  }

  return null;
}

function consumeCoreSseLines(buffer: string): { remainder: string; events: CarinaChatStreamEvent[] } {
  const events: CarinaChatStreamEvent[] = [];
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data || data === '[DONE]') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      events.push({ type: 'text', content: data });
      continue;
    }

    try {
      const event = normalizeCoreEvent(parsed);
      if (event) events.push(event);
    } catch (err) {
      if (err instanceof ChatStreamError) throw err;
      events.push({ type: 'text', content: data });
    }
  }

  return { remainder, events };
}

async function buildSystemPrompt(
  workspaceId: string,
  activePacks: string[] = [],
  profileId?: string | null,
): Promise<string> {
  const brain = await getWorkspaceBrainSettings(workspaceId);

  const [profile, memories, disabledSkills, enabledSkills] = await Promise.all([
    profileId ? getWorkspaceProfile(workspaceId, profileId) : Promise.resolve(null),
    brain.injectMemoriesInChat
      ? db
          .select({ content: userMemories.content, type: userMemories.type })
          .from(userMemories)
          .where(and(eq(userMemories.workspaceId, workspaceId), eq(userMemories.enabled, true)))
          .limit(50)
      : Promise.resolve([]),
    db
      .select({ skillId: workspaceSkills.skillId })
      .from(workspaceSkills)
      .where(and(eq(workspaceSkills.workspaceId, workspaceId), eq(workspaceSkills.enabled, false))),
    db
      .select({
        skillId: workspaceSkills.skillId,
        name: workspaceSkills.name,
        description: workspaceSkills.description,
      })
      .from(workspaceSkills)
      .where(and(eq(workspaceSkills.workspaceId, workspaceId), eq(workspaceSkills.enabled, true)))
      .orderBy(desc(workspaceSkills.updatedAt))
      .limit(brain.maxSkillsPerRequest),
  ]);

  const memoryBlock =
    memories.length > 0
      ? `\n\nWhat you remember about this user:\n${memories
          .map((memory) => `- [${memory.type}] ${memory.content}`)
          .join('\n')}`
      : '';

  if (profile?.systemPrompt?.trim()) {
    return `${profile.systemPrompt.trim()}${memoryBlock}`;
  }

  const disabledSkillIds = disabledSkills.map((skill) => skill.skillId);
  const disabledBlock =
    disabledSkillIds.length > 0
      ? `\n\nDisabled tools for this session (do not invoke): ${disabledSkillIds.join(', ')}`
      : '';
  const enabledBlock =
    enabledSkills.length > 0
      ? `\n\nCustom skill notes for this session (prompt hints only, not live tools; max ${brain.maxSkillsPerRequest}):\n${enabledSkills
          .map((skill) => `- ${skill.name ?? skill.skillId}: ${skill.description ?? 'No description'}`)
          .join('\n')}`
      : '';

  return buildCloudSystemPrompt({
    workspaceId,
    memoryBlock,
    enabledSkillsBlock: enabledBlock,
    disabledSkillsBlock: disabledBlock,
    activePacks,
  });
}

function isSecretExfiltrationRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (/\.env(?:\.(?:local|production|development|example|test))?\b/i.test(text)) return true;
  if (
    /\b(show|read|display|reveal|print|dump|cat|output|give|share|tell|list|expose)\b/i.test(text)
    && /\b(credentials?|secrets?|api[\s_-]?keys?|passwords?|tokens?|\.env)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

export async function* streamCarinaChat(input: {
  message: string;
  sessionId: string;
  workspaceId: string;
  providerKeys: Array<{ provider: string; apiKey: string }>;
  skillPacks: string[];
  provider?: string;
  model?: string;
  profileId?: string | null;
}): AsyncGenerator<CarinaChatStreamEvent> {
  if (input.providerKeys.length === 0 && requiresWorkspaceByokKeys()) {
    throw new ChatStreamError(
      'Add at least one provider key in Settings before chatting.',
      'NO_BYOK_KEYS',
    );
  }

  if (isSecretExfiltrationRequest(input.message)) {
    yield { type: 'text', content: 'No.' };
    return;
  }

  const systemPrompt = await buildSystemPrompt(input.workspaceId, input.skillPacks, input.profileId);

  if (coreProxyEnabled()) {
    const coreUrl = resolveCoreUrl();
    const token = resolveCoreProxyToken();
    const url = new URL('/api/chat/stream', coreUrl);
    url.searchParams.set('message', input.message);
    url.searchParams.set('sessionId', `cloud:${input.workspaceId}:${input.sessionId}`);
    url.searchParams.set('systemPrompt', systemPrompt);
    if (input.provider) url.searchParams.set('provider', input.provider);
    if (input.model) url.searchParams.set('model', input.model);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new ChatStreamError(
        'Carina could not reach the agent backend. Check Settings or try again.',
        'CORE_PROXY_FAILED',
      );
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      const suffix = detail ? ` (${res.status})` : ` (${res.status})`;
      throw new ChatStreamError(
        `Carina could not reach the agent backend${suffix}. Check Settings or try again.`,
        'CORE_PROXY_FAILED',
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const { remainder, events } = consumeCoreSseLines(sseBuffer);
      sseBuffer = remainder;
      for (const event of events) {
        yield event;
      }
    }
    sseBuffer += decoder.decode();
    const { events } = consumeCoreSseLines(`${sseBuffer}\n`);
    for (const event of events) {
      yield event;
    }
    return;
  }

  const provider = resolveProvider(input.providerKeys, input.provider, input.model);
  yield* streamOpenAiCompatible(
    provider.url,
    provider.apiKey,
    provider.model,
    input.message,
    systemPrompt,
  );
}
