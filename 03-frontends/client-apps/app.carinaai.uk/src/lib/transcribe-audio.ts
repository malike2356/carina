import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { resolveCoreUrl, resolveCoreProxyToken } from '@/lib/core-proxy';
import { probeLocalWhisperAvailable, transcribeAudioLocal } from '@/lib/transcribe-local';

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

export type TranscriptionProviderId = (typeof PROVIDERS)[number]['id'];

export type TranscriptionSource =
  | 'platform-groq'
  | 'platform-openai'
  | 'workspace-groq'
  | 'workspace-openai'
  | 'core'
  | 'local';

export type TranscriptionTier = 'browser' | 'platform-whisper' | 'local-whisper';

export type TranscriptionAttempt = {
  providerId: TranscriptionProviderId;
  apiKey: string;
  source: Exclude<TranscriptionSource, 'core' | 'local'>;
};

export type VoiceTranscriptionCapabilities = {
  /** Server-side transcription is available (platform Whisper and/or local Whisper). */
  serverTranscription: boolean;
  platformWhisper: boolean;
  localWhisper: boolean;
  coreReachable: boolean;
  appLocalWhisper: boolean;
  sources: TranscriptionSource[];
  tiers: TranscriptionTier[];
  primarySource: TranscriptionSource | null;
};

function providerConfig(id: TranscriptionProviderId) {
  const provider = PROVIDERS.find((entry) => entry.id === id);
  if (!provider) throw new Error(`unknown transcription provider: ${id}`);
  return provider;
}

function platformGroqKey(): string {
  return process.env.GROQ_API_KEY?.trim() ?? '';
}

function platformOpenAiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? '';
}

function workspaceKey(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
  provider: TranscriptionProviderId,
): string {
  return workspaceKeys.find((entry) => entry.provider === provider)?.apiKey?.trim() ?? '';
}

function audioExtension(mimeType?: string): string {
  const raw = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (raw === 'audio/webm' || raw === 'video/webm') return '.webm';
  if (raw === 'audio/ogg' || raw === 'application/ogg') return '.ogg';
  if (raw === 'audio/wav' || raw === 'audio/x-wav') return '.wav';
  if (raw === 'audio/mpeg' || raw === 'audio/mp3') return '.mp3';
  if (raw === 'audio/mp4' || raw === 'audio/m4a') return '.m4a';
  if (raw === 'audio/opus' || raw === 'audio/ogg;codecs=opus') return '.opus';
  return '.webm';
}

/** Platform Groq first, then OpenAI; workspace BYOK overrides the platform key per provider. */
export function resolveTranscriptionAttempts(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
): TranscriptionAttempt[] {
  const attempts: TranscriptionAttempt[] = [];

  const groqKey = workspaceKey(workspaceKeys, 'groq') || platformGroqKey();
  if (groqKey) {
    attempts.push({
      providerId: 'groq',
      apiKey: groqKey,
      source: workspaceKey(workspaceKeys, 'groq') ? 'workspace-groq' : 'platform-groq',
    });
  }

  const openaiKey = workspaceKey(workspaceKeys, 'openai') || platformOpenAiKey();
  if (openaiKey) {
    attempts.push({
      providerId: 'openai',
      apiKey: openaiKey,
      source: workspaceKey(workspaceKeys, 'openai') ? 'workspace-openai' : 'platform-openai',
    });
  }

  return attempts;
}

export function buildVoiceTranscriptionCapabilities(input: {
  workspaceKeys: Array<{ provider: string; apiKey: string }>;
  coreReachable: boolean;
  appLocalWhisper: boolean;
}): VoiceTranscriptionCapabilities {
  const attempts = resolveTranscriptionAttempts(input.workspaceKeys);
  const platformWhisper = attempts.length > 0;
  const localWhisper = input.coreReachable || input.appLocalWhisper;

  const sources: TranscriptionSource[] = attempts.map((attempt) => attempt.source);
  if (input.coreReachable) sources.push('core');
  if (input.appLocalWhisper) sources.push('local');

  const tiers: TranscriptionTier[] = ['browser'];
  if (platformWhisper) tiers.push('platform-whisper');
  if (localWhisper) tiers.push('local-whisper');

  return {
    serverTranscription: platformWhisper || localWhisper,
    platformWhisper,
    localWhisper,
    coreReachable: input.coreReachable,
    appLocalWhisper: input.appLocalWhisper,
    sources,
    tiers,
    primarySource:
      attempts[0]?.source
      ?? (input.coreReachable ? 'core' : input.appLocalWhisper ? 'local' : null),
  };
}

/** @deprecated Use buildVoiceTranscriptionCapabilities instead. */
export function getServerTranscriptionAvailability(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
  coreReachable: boolean,
): {
  available: boolean;
  sources: TranscriptionSource[];
  primarySource: TranscriptionSource | null;
  coreReachable: boolean;
} {
  const caps = buildVoiceTranscriptionCapabilities({
    workspaceKeys,
    coreReachable,
    appLocalWhisper: false,
  });
  return {
    available: caps.serverTranscription,
    sources: caps.sources,
    primarySource: caps.primarySource,
    coreReachable: caps.coreReachable,
  };
}

export async function probeCoreTranscriptionReachable(): Promise<boolean> {
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  try {
    const res = await fetch(`${coreUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function probeVoiceTranscriptionCapabilities(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
): Promise<VoiceTranscriptionCapabilities> {
  const [coreReachable, appLocalWhisper] = await Promise.all([
    probeCoreTranscriptionReachable(),
    probeLocalWhisperAvailable(),
  ]);
  return buildVoiceTranscriptionCapabilities({
    workspaceKeys,
    coreReachable,
    appLocalWhisper,
  });
}

/** @deprecated Use resolveTranscriptionAttempts instead. */
export function mergeTranscriptionKeys(
  workspaceKeys: Array<{ provider: string; apiKey: string }>,
): Array<{ provider: string; apiKey: string }> {
  return resolveTranscriptionAttempts(workspaceKeys).map((attempt) => ({
    provider: attempt.providerId,
    apiKey: attempt.apiKey,
  }));
}

/** Proxy transcription to core (platform OpenAI there, then local Whisper). */
async function transcribeViaCore(
  audio: Buffer,
  mimeType: string,
  language: string,
): Promise<{ text: string; provider: string } | { error: string }> {
  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'X-Transcribe-Lang': language,
  };
  const token = resolveCoreProxyToken();
  if (token) {
    headers.authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }
  try {
    const res = await fetch(
      `${coreUrl}/api/transcribe?language=${encodeURIComponent(language)}`,
      {
        method: 'POST',
        headers,
        body: new Uint8Array(audio),
        signal: AbortSignal.timeout(120_000),
      },
    );
    const payload = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok) return { error: payload.error ?? `core returned HTTP ${res.status}` };
    const text = String(payload.text ?? '').trim();
    if (!text) return { error: 'empty transcription from core' };
    return { text, provider: 'core' };
  } catch (err) {
    return { error: `core proxy failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function transcribeViaAppLocal(
  audio: Buffer,
  mimeType: string,
  language: string,
): Promise<{ text: string; provider: string } | { error: string }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-voice-'));
  const filePath = path.join(tempDir, `voice-${randomUUID()}${audioExtension(mimeType)}`);

  try {
    await fs.writeFile(filePath, audio);
    const result = await transcribeAudioLocal(filePath, language);
    if ('text' in result) return { text: result.text, provider: 'local' };
    return { error: result.error };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
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

/**
 * Server transcription tiers (after browser-native on the client):
 * 1. Platform/workspace Whisper (Groq first, then OpenAI)
 * 2. Core backend (OpenAI there, then local Whisper)
 * 3. App-local Whisper subprocess
 */
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

  const attempts = resolveTranscriptionAttempts(workspaceKeys);
  const errors: string[] = [];

  for (const attempt of attempts) {
    const provider = providerConfig(attempt.providerId);
    const result = await transcribeWithProvider(provider, attempt.apiKey, audio, mimeType, language);
    if ('text' in result) {
      return { text: result.text, provider: attempt.source };
    }
    errors.push(`${attempt.source}: ${result.error}`);
  }

  const coreResult = await transcribeViaCore(audio, mimeType, language);
  if ('text' in coreResult) return coreResult;
  errors.push(`core: ${coreResult.error}`);

  const localAvailable = await probeLocalWhisperAvailable();
  if (localAvailable) {
    const localResult = await transcribeViaAppLocal(audio, mimeType, language);
    if ('text' in localResult) return localResult;
    errors.push(`local: ${localResult.error}`);
  }

  if (errors.length === 0) {
    return {
      error:
        'Voice transcription is not configured. Use Chrome or Edge for live dictation, set GROQ_API_KEY on the platform, or ensure core local Whisper is reachable.',
    };
  }

  return { error: errors.join('; ') };
}
