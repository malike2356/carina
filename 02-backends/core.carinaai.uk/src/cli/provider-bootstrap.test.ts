import { describe, expect, it, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
const createMock = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: generateContentMock,
      };
    }
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: createMock,
    },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
}));

vi.mock('../../../src/config/paths.js', () => ({
  resolveCarinaHome: () => '/tmp/carina-home',
}));

import { PROVIDER_MODELS, hasLlmApiKeyInEnvContents, testProviderConnection } from './provider-bootstrap.js';

describe('provider bootstrap', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    createMock.mockReset();
  });

  it('includes gemini in the default provider models', () => {
    expect(PROVIDER_MODELS.gemini).toBe('gemini-2.0-flash');
  });

  it('detects gemini api keys in env contents', () => {
    expect(hasLlmApiKeyInEnvContents('GEMINI_API_KEY=abc123')).toBe(true);
  });

  it('tests gemini connections through the gemini client', async () => {
    generateContentMock.mockResolvedValue({});
    await testProviderConnection('gemini', 'test-key', 'gemini-2.0-flash');
    expect(generateContentMock).toHaveBeenCalledWith('Reply with OK.');
  });
});
