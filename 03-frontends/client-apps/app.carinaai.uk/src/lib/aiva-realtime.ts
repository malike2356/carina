import { createHash } from 'node:crypto';

export const REALTIME_MODEL =
  process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-realtime-2.1';

export const REALTIME_VOICE =
  process.env.OPENAI_REALTIME_VOICE?.trim() || 'marin';

const MAX_INSTRUCTIONS = 6000;

export function resolveOpenAiApiKey(
  workspaceKeys: Array<{ provider: string; apiKey: string }> = [],
): string | null {
  const byok = workspaceKeys.find(
    (row) => row.provider === 'openai' && row.apiKey.trim().length > 20,
  );
  if (byok) return byok.apiKey.trim();
  const envKey = process.env.OPENAI_API_KEY?.trim() || '';
  return envKey.length > 20 ? envKey : null;
}

export function buildRealtimeInstructions(worker: {
  name: string;
  roleDescription?: string | null;
  personaPrompt?: string | null;
}): string {
  const name = worker.name.trim() || 'Aiva';
  const role = (worker.roleDescription ?? '').trim();
  const persona = (worker.personaPrompt ?? '').trim();

  const blocks = [
    `You are ${name}, an Aiva voice coworker speaking live on a phone-like call.`,
    'Speak naturally in short turns. Prefer spoken English (UK) unless the caller uses another language.',
    'Do not narrate tool use or say you are an AI model unless asked. Stay in character.',
    'If you need information you do not have, ask one clear question.',
    role ? `Your role: ${role}` : '',
    persona ? `Persona and boundaries:\n${persona}` : '',
  ].filter(Boolean);

  let text = blocks.join('\n\n');
  if (text.length > MAX_INSTRUCTIONS) {
    text = `${text.slice(0, MAX_INSTRUCTIONS - 20)}\n…[truncated]`;
  }
  return text;
}

export function buildRealtimeSessionConfig(
  worker: {
    name: string;
    roleDescription?: string | null;
    personaPrompt?: string | null;
  },
  extras?: {
    tools?: Array<{
      type: 'function';
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
    instructionsSuffix?: string;
  },
): Record<string, unknown> {
  const instructions = [
    buildRealtimeInstructions(worker),
    extras?.instructionsSuffix?.trim() || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const session: Record<string, unknown> = {
    type: 'realtime',
    model: REALTIME_MODEL,
    instructions,
    audio: {
      input: {
        transcription: {
          model: 'gpt-4o-mini-transcribe',
        },
      },
      output: {
        voice: REALTIME_VOICE,
      },
    },
  };

  if (extras?.tools && extras.tools.length > 0) {
    session.tools = extras.tools;
    session.tool_choice = 'auto';
  }

  return session;
}

export function safetyIdentifierFor(workspaceId: string, userId?: string | null): string {
  return createHash('sha256')
    .update(`aiva-realtime:${workspaceId}:${userId ?? 'anon'}`)
    .digest('hex')
    .slice(0, 64);
}

export type RealtimeAccessProbe = {
  ok: boolean;
  reason: string | null;
  code: 'ok' | 'missing_key' | 'quota' | 'auth' | 'unreachable' | 'unknown';
};

type CachedProbe = { at: number; result: RealtimeAccessProbe };

const probeCache = new Map<string, CachedProbe>();
const PROBE_TTL_MS = 60_000;

function cacheKeyForApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 24);
}

/**
 * Cheap Realtime access check: send a minimal invalid audio offer.
 * - invalid_offer / 400 => API key can reach Realtime (treat as healthy)
 * - 429 / insufficient_quota => unusable until billing/BYOK fixed
 * - 401 => bad key
 */
export async function probeRealtimeAccess(input: {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}): Promise<RealtimeAccessProbe> {
  const key = input.apiKey.trim();
  if (key.length < 20) {
    return {
      ok: false,
      code: 'missing_key',
      reason: 'Realtime voice needs an OpenAI API key (platform or workspace BYOK).',
    };
  }

  const cacheKey = cacheKeyForApiKey(key);
  const cached = probeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PROBE_TTL_MS) {
    return cached.result;
  }

  const model = input.model?.trim() || REALTIME_MODEL;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const sdp = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 0.0.0.0',
    'a=rtpmap:111 opus/48000/2',
    'a=ice-ufrag:probe',
    'a=ice-pwd:probepasswordprobepass',
    'a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
    'a=setup:actpass',
    'a=mid:0',
    'a=sendrecv',
  ].join('\r\n') + '\r\n';

  const fd = new FormData();
  fd.set('sdp', sdp);
  fd.set(
    'session',
    JSON.stringify({
      type: 'realtime',
      model,
      instructions: 'probe',
      audio: { output: { voice: REALTIME_VOICE } },
    }),
  );

  let result: RealtimeAccessProbe;
  try {
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'OpenAI-Safety-Identifier': 'a'.repeat(64),
      },
      body: fd,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let message = '';
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } };
      message = parsed.error?.message || parsed.error?.code || '';
    } catch {
      message = text.slice(0, 200);
    }
    const lower = message.toLowerCase();

    if (response.status === 429 || lower.includes('insufficient_quota') || lower.includes('exceeded your current quota')) {
      result = {
        ok: false,
        code: 'quota',
        reason:
          'OpenAI realtime quota is exhausted. Add billing credit or an OpenAI key under Settings → Keys. Using classic voice for now.',
      };
    } else if (response.status === 401 || lower.includes('invalid_api_key') || lower.includes('incorrect api key')) {
      result = {
        ok: false,
        code: 'auth',
        reason: 'OpenAI API key is invalid for realtime. Using classic voice for now.',
      };
    } else if (
      response.status === 400
      || lower.includes('invalid_offer')
      || lower.includes('audio media section')
    ) {
      // Expected for the probe SDP: means Realtime accepted the auth and rejected only the fake offer.
      result = { ok: true, code: 'ok', reason: null };
    } else if (response.ok) {
      result = { ok: true, code: 'ok', reason: null };
    } else {
      result = {
        ok: false,
        code: 'unknown',
        reason: message || `OpenAI realtime probe failed (${response.status}). Using classic voice for now.`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = {
      ok: false,
      code: 'unreachable',
      reason: `Could not reach OpenAI realtime (${message}). Using classic voice for now.`,
    };
  }

  probeCache.set(cacheKey, { at: Date.now(), result });
  return result;
}

/** Mark realtime as unhealthy after a live connect failure (shared with GET probe cache). */
export function markRealtimeAccessFailed(apiKey: string, reason: string, code: RealtimeAccessProbe['code'] = 'unknown'): void {
  const key = apiKey.trim();
  if (key.length < 20) return;
  probeCache.set(cacheKeyForApiKey(key), {
    at: Date.now(),
    result: { ok: false, code, reason },
  });
}

export function isRealtimeFallbackError(message: string, status?: number): boolean {
  const text = message.toLowerCase();
  return (
    status === 429
    || status === 401
    || status === 503
    || status === 504
    || text.includes('insufficient_quota')
    || text.includes('quota')
    || text.includes('rate limit')
    || text.includes('invalid_api_key')
    || text.includes('incorrect api key')
    || text.includes('timed out')
    || text.includes('realtime_unavailable')
    || text.includes('could not reach')
  );
}

export async function createRealtimeCallAnswer(input: {
  apiKey: string;
  offerSdp: string;
  session: Record<string, unknown>;
  safetyIdentifier: string;
  timeoutMs?: number;
}): Promise<{ ok: true; sdp: string } | { ok: false; status: number; error: string }> {
  const fd = new FormData();
  fd.set('sdp', input.offerSdp);
  fd.set('session', JSON.stringify(input.session));

  const timeoutMs = input.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'OpenAI-Safety-Identifier': input.safetyIdentifier,
      },
      body: fd,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 504, error: `OpenAI realtime timed out after ${Math.round(timeoutMs / 1000)}s` };
    }
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : 'OpenAI realtime request failed',
    };
  }
  clearTimeout(timer);

  const text = await response.text();
  if (!response.ok) {
    let error = `OpenAI realtime failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) error = parsed.error.message;
    } catch {
      if (text.trim()) error = text.trim().slice(0, 400);
    }
    return { ok: false, status: response.status, error };
  }

  if (!text.includes('v=0')) {
    return { ok: false, status: 502, error: 'OpenAI returned an invalid SDP answer' };
  }

  return { ok: true, sdp: text };
}
