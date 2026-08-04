import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    constructor(_apiKey: string) {}

    getGenerativeModel() {
      return {
        embedContent: vi.fn().mockResolvedValue({
          embedding: { values: Array(768).fill(0.1) },
        }),
      };
    }
  },
}));

vi.mock('../config/load-env.js', () => ({
  loadCarinaEnv: vi.fn(),
  envExists: vi.fn(() => false),
}));

vi.mock('../cli/config/loader.js', () => ({
  applyYamlConfigToEnv: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function voyageOkResponse(values: number[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: [{ embedding: values }] }),
  });
}

function openaiOkResponse(values: number[]) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: [{ embedding: values }] }),
  });
}

describe('embeddings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses Gemini when GEMINI_API_KEY is set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('VOYAGE_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { embed, embeddingProviderStatus } = await import('./embeddings.js');
    expect(embeddingProviderStatus().active).toBe('gemini');
    const result = await embed('test text');
    expect(result).toHaveLength(768);
    expect(result[0]).toBeCloseTo(0.1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses Voyage when VOYAGE_API_KEY is set and Gemini is not', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VOYAGE_API_KEY', 'voyage-test-key');
    vi.stubEnv('OPENAI_API_KEY', '');
    const voyageVec = Array(768).fill(0.3);
    mockFetch.mockReturnValueOnce(voyageOkResponse(voyageVec));
    const { embed } = await import('./embeddings.js');
    const result = await embed('test text');
    expect(result).toHaveLength(768);
    expect(result[0]).toBeCloseTo(0.3);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('voyageai.com');
  });

  it('Voyage request includes output_dimension=768', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VOYAGE_API_KEY', 'vk');
    vi.stubEnv('OPENAI_API_KEY', '');
    mockFetch.mockReturnValueOnce(voyageOkResponse(Array(768).fill(0)));
    const { embed } = await import('./embeddings.js');
    await embed('hello');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string) as {
      output_dimension: number;
      model: string;
    };
    expect(body.output_dimension).toBe(768);
    expect(body.model).toBe('voyage-3');
  });

  it('falls back from Gemini to Voyage on Gemini failure', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    vi.stubEnv('VOYAGE_API_KEY', 'vk');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValueOnce({
      embedContent: () => Promise.reject(new Error('Gemini quota exceeded')),
    } as never);
    mockFetch.mockReturnValueOnce(voyageOkResponse(Array(768).fill(0.7)));
    const { embed } = await import('./embeddings.js');
    const result = await embed('fallback test');
    expect(result[0]).toBeCloseTo(0.7);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('falls back from Voyage to OpenAI-compatible on Voyage failure', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VOYAGE_API_KEY', 'vk');
    vi.stubEnv('OPENAI_API_KEY', 'ok');
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 429, text: async () => '' }))
      .mockReturnValueOnce(openaiOkResponse(Array(768).fill(0.2)));
    const { embed } = await import('./embeddings.js');
    const result = await embed('fallback test');
    expect(result).toHaveLength(768);
    expect(result[0]).toBeCloseTo(0.2);
  });

  it('returns empty array when no provider configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VOYAGE_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { embed } = await import('./embeddings.js');
    const result = await embed('no providers');
    expect(result).toEqual([]);
  });

  it('VOYAGE_MODEL env overrides default voyage-3', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VOYAGE_API_KEY', 'vk');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('VOYAGE_MODEL', 'voyage-3-large');
    mockFetch.mockReturnValueOnce(voyageOkResponse(Array(768).fill(0)));
    const { embed } = await import('./embeddings.js');
    await embed('model override');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string) as { model: string };
    expect(body.model).toBe('voyage-3-large');
  });

  it('CARINA_EMBEDDING_PROVIDER pins a provider first without hardcoding OpenAI', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    vi.stubEnv('VOYAGE_API_KEY', 'vk');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('CARINA_EMBEDDING_PROVIDER', 'voyage');
    mockFetch.mockReturnValueOnce(voyageOkResponse(Array(768).fill(0.9)));
    const { embed, embeddingProviderStatus } = await import('./embeddings.js');
    const status = embeddingProviderStatus();
    expect(status.active).toBe('voyage');
    expect(status.chain[0]).toBe('voyage');
    const result = await embed('priority test');
    expect(result[0]).toBeCloseTo(0.9);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('prefers Gemini over OpenAI when both keys exist', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    vi.stubEnv('OPENAI_API_KEY', 'ok');
    vi.stubEnv('VOYAGE_API_KEY', '');
    const { embed, resolveEmbeddingChain } = await import('./embeddings.js');
    expect(resolveEmbeddingChain()[0]).toBe('gemini');
    const result = await embed('prefer gemini');
    expect(result[0]).toBeCloseTo(0.1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
