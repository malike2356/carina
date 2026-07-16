import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildVoiceTranscriptionCapabilities,
  resolveTranscriptionAttempts,
} from '@/lib/transcribe-audio';
import { resolveVoiceComposerHintKey } from '@/lib/voice-composer-hint';

describe('resolveTranscriptionAttempts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers platform Groq as the default cloud path', () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk-platform');
    vi.stubEnv('OPENAI_API_KEY', 'sk-platform');

    const attempts = resolveTranscriptionAttempts([]);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      providerId: 'groq',
      apiKey: 'gsk-platform',
      source: 'platform-groq',
    });
    expect(attempts[1]?.source).toBe('platform-openai');
  });

  it('lets workspace Groq override the platform Groq key', () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk-platform');

    const attempts = resolveTranscriptionAttempts([{ provider: 'groq', apiKey: 'gsk-workspace' }]);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      providerId: 'groq',
      apiKey: 'gsk-workspace',
      source: 'workspace-groq',
    });
  });

  it('includes workspace OpenAI when platform keys are absent', () => {
    const attempts = resolveTranscriptionAttempts([{ provider: 'openai', apiKey: 'sk-workspace' }]);
    expect(attempts).toEqual([
      {
        providerId: 'openai',
        apiKey: 'sk-workspace',
        source: 'workspace-openai',
      },
    ]);
  });
});

describe('buildVoiceTranscriptionCapabilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unavailable when no platform keys or local paths exist', () => {
    const caps = buildVoiceTranscriptionCapabilities({
      workspaceKeys: [],
      coreReachable: false,
      appLocalWhisper: false,
    });
    expect(caps.serverTranscription).toBe(false);
    expect(caps.tiers).toEqual(['browser']);
    expect(caps.primarySource).toBeNull();
  });

  it('reports platform Groq as the primary source on cloud', () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk-platform');
    const caps = buildVoiceTranscriptionCapabilities({
      workspaceKeys: [],
      coreReachable: false,
      appLocalWhisper: false,
    });
    expect(caps.serverTranscription).toBe(true);
    expect(caps.platformWhisper).toBe(true);
    expect(caps.primarySource).toBe('platform-groq');
    expect(caps.tiers).toEqual(['browser', 'platform-whisper']);
  });

  it('includes local whisper from core and app', () => {
    const caps = buildVoiceTranscriptionCapabilities({
      workspaceKeys: [],
      coreReachable: true,
      appLocalWhisper: true,
    });
    expect(caps.localWhisper).toBe(true);
    expect(caps.sources).toEqual(['core', 'local']);
    expect(caps.tiers).toEqual(['browser', 'local-whisper']);
  });
});

describe('resolveVoiceComposerHintKey', () => {
  it('selects the all-tiers hint when every path is available', () => {
    expect(
      resolveVoiceComposerHintKey({
        liveDictationAvailable: true,
        platformWhisper: true,
        localWhisper: true,
      }),
    ).toBe('chat.voiceAllTiers');
  });

  it('selects server-only hints when live dictation is unavailable', () => {
    expect(
      resolveVoiceComposerHintKey({
        liveDictationAvailable: false,
        platformWhisper: true,
        localWhisper: true,
      }),
    ).toBe('chat.voiceServerPlatformLocal');
  });
});
