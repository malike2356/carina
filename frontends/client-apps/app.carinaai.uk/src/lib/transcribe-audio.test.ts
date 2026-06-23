import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getServerTranscriptionAvailability,
  resolveTranscriptionAttempts,
} from '@/lib/transcribe-audio';

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

describe('getServerTranscriptionAvailability', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unavailable when no keys or core are reachable', () => {
    const availability = getServerTranscriptionAvailability([], false);
    expect(availability.available).toBe(false);
    expect(availability.primarySource).toBeNull();
    expect(availability.sources).toEqual([]);
  });

  it('reports platform Groq as the primary source on cloud', () => {
    vi.stubEnv('GROQ_API_KEY', 'gsk-platform');
    const availability = getServerTranscriptionAvailability([], false);
    expect(availability.available).toBe(true);
    expect(availability.primarySource).toBe('platform-groq');
    expect(availability.sources).toEqual(['platform-groq']);
  });

  it('includes core when the health probe succeeds', () => {
    const availability = getServerTranscriptionAvailability([], true);
    expect(availability.available).toBe(true);
    expect(availability.primarySource).toBe('core');
    expect(availability.sources).toEqual(['core']);
    expect(availability.coreReachable).toBe(true);
  });
});
