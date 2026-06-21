const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const PROVIDERS = [
  {
    id: 'groq',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3',
  },
  {
    id: 'openai',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
  },
] as const;

function platformTranscriptionKeys(): Array<{ provider: string; apiKey: string }> {
  const keys: Array<{ provider: string; apiKey: string }> = [];
  const groq = process.env.GROQ_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (groq) keys.push({ provider: 'groq', apiKey: groq });
  if (openai) keys.push({ provider: 'openai', apiKey: openai });
  return keys;
}

/** Workspace BYOK keys override platform env keys for the same provider. */
export function mergeTranscriptionKeys(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
): Array<{ provider: string; apiKey: string }> {
  const merged = new Map<string, string>();
  for (const key of platformTranscriptionKeys()) {
    merged.set(key.provider, key.apiKey);
  }
  for (const key of workspaceKeys) {
    const trimmed = key.apiKey?.trim();
    if (trimmed) merged.set(key.provider, trimmed);
  }
  return Array.from(merged.entries()).map(([provider, apiKey]) => ({ provider, apiKey }));
}

function filenameForMime(mimeType: string): string {
  const raw = mimeType.split(';')[0].trim().toLowerCase();
  if (raw.includes('webm')) return 'audio.webm';
  if (raw.includes('ogg')) return 'audio.ogg';
  if (raw.includes('wav')) return 'audio.wav';
  if (raw.includes('mpeg') || raw.includes('mp3')) return 'audio.mp3';
  if (raw.includes('m4a') || raw.includes('mp4')) return 'audio.m4a';
  return 'audio.webm';
}

async function transcribeWithProvider(
  provider: (typeof PROVIDERS)[number],
  apiKey: string,
  audio: Buffer,
  mimeType: string,
  language?: string,
): Promise<{ text: string } | { error: string }> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(audio)], { type: mimeType || 'audio/webm' }),
    filenameForMime(mimeType),
  );
  form.append('model', provider.model);
  if (language) form.append('language', language);

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } | string };
  if (!res.ok) {
    const detail =
      typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message ?? `HTTP ${res.status}`;
    return { error: detail };
  }

  const text = String(payload.text ?? '').trim();
  if (!text) return { error: 'empty transcription' };
  return { text };
}

export async function transcribeWorkspaceAudio(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
  audio: Buffer,
  mimeType: string,
  language = 'en',
): Promise<{ text: string; provider: string } | { error: string }> {
  if (audio.length === 0) return { error: 'audio payload is empty' };
  if (audio.length > MAX_AUDIO_BYTES) {
    return { error: `audio exceeds ${MAX_AUDIO_BYTES} byte limit` };
  }

  const keys = mergeTranscriptionKeys(workspaceKeys);
  const errors: string[] = [];
  for (const provider of PROVIDERS) {
    const key = keys.find((k) => k.provider === provider.id)?.apiKey?.trim();
    if (!key) continue;
    const result = await transcribeWithProvider(provider, key, audio, mimeType, language);
    if ('text' in result) return { text: result.text, provider: provider.id };
    errors.push(`${provider.id}: ${result.error}`);
  }

  if (errors.length === 0) {
    return {
      error: 'Add an OpenAI or Groq API key in Settings, or configure GROQ_API_KEY on the server for voice input.',
    };
  }
  return { error: errors.join('; ') };
}
