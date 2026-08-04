import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeSetting: vi.fn(),
  readDomainSettings: vi.fn(),
  embeddingProviderStatus: vi.fn(),
  listEmbeddingProviders: vi.fn(),
  isEmbeddingProviderConfigured: vi.fn(),
  providerApiKey: vi.fn(),
  providerBaseUrl: vi.fn(),
  providerModel: vi.fn(),
  poolQuery: vi.fn(),
  embed: vi.fn(),
}));

vi.mock('../config/settings-store.js', () => ({
  writeSetting: mocks.writeSetting,
  readDomainSettings: mocks.readDomainSettings,
}));

vi.mock('../memory/embeddings.js', () => ({
  DIMENSIONS: 768,
  embed: mocks.embed,
  embeddingProviderStatus: mocks.embeddingProviderStatus,
}));

vi.mock('../brain/provider-registry.js', () => ({
  PROVIDER_MAP: {
    ollama: { name: 'ollama' },
    gemini: { name: 'gemini' },
    openai: { name: 'openai' },
  },
  listEmbeddingProviders: mocks.listEmbeddingProviders,
  isEmbeddingProviderConfigured: mocks.isEmbeddingProviderConfigured,
  providerApiKey: mocks.providerApiKey,
  providerBaseUrl: mocks.providerBaseUrl,
  providerModel: mocks.providerModel,
}));

vi.mock('../memory/db.js', () => ({
  pool: { query: mocks.poolQuery },
}));

vi.mock('../config/index.js', () => ({
  config: {
    embeddings: {
      geminiModel: 'text-embedding-004',
      openaiModel: 'text-embedding-3-small',
    },
  },
}));

vi.mock('pgvector/pg', () => ({
  default: { toSql: (v: number[]) => `[${v.join(',')}]` },
}));

import {
  getEmbeddingsPlatformStatus,
  saveEmbeddingsPlatformConfig,
  probeEmbeddings,
  backfillMissingEmbeddings,
} from './embeddings-platform.js';

describe('embeddings-platform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CARINA_EMBEDDING_PROVIDER;
    delete process.env.OLLAMA_ENABLED;
    mocks.readDomainSettings.mockResolvedValue({});
    mocks.writeSetting.mockResolvedValue({ ok: true });
    mocks.embeddingProviderStatus.mockReturnValue({
      active: 'ollama',
      configured: ['ollama'],
      chain: ['ollama'],
      dimensions: 768,
      override: 'ollama',
    });
    mocks.listEmbeddingProviders.mockReturnValue([
      {
        name: 'ollama',
        displayName: 'Ollama',
        kind: 'openai',
        local: true,
        apiKeyEnv: 'OLLAMA_API_KEY',
        fallbackPriority: 21,
      },
      {
        name: 'gemini',
        displayName: 'Gemini',
        kind: 'gemini',
        local: false,
        apiKeyEnv: 'GEMINI_API_KEY',
        fallbackPriority: 1,
      },
    ]);
    mocks.isEmbeddingProviderConfigured.mockImplementation((def: { name: string }) => def.name === 'ollama');
    mocks.providerApiKey.mockReturnValue('');
    mocks.providerBaseUrl.mockReturnValue('http://carina-ollama-embed:11434/v1');
    mocks.providerModel.mockReturnValue('llama3.2');
    mocks.poolQuery.mockResolvedValue({
      rows: [{ total: '10', embedded: '8' }],
    });
  });

  it('getEmbeddingsPlatformStatus applies DB preferred provider and reports coverage', async () => {
    mocks.readDomainSettings.mockResolvedValue({
      CARINA_EMBEDDING_PROVIDER: 'ollama',
    });

    const status = await getEmbeddingsPlatformStatus();

    expect(process.env.CARINA_EMBEDDING_PROVIDER).toBe('ollama');
    expect(status.preferredProvider).toBe('ollama');
    expect(status.totalChunks).toBe(10);
    expect(status.embeddedChunks).toBe(8);
    expect(status.missingChunks).toBe(2);
    expect(status.source).toBe('carina_settings');
    expect(status.providers.some((p) => p.name === 'ollama' && p.configured)).toBe(true);
  });

  it('saveEmbeddingsPlatformConfig writes preferred provider and ollama fields', async () => {
    const result = await saveEmbeddingsPlatformConfig({
      preferredProvider: 'ollama',
      ollamaBaseUrl: 'http://carina-ollama-embed:11434/v1',
      ollamaEnabled: true,
      ollamaEmbeddingModel: 'nomic-embed-text',
    });

    expect(result.ok).toBe(true);
    expect(mocks.writeSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'CARINA_EMBEDDING_PROVIDER',
        value: 'ollama',
        envVar: 'CARINA_EMBEDDING_PROVIDER',
      }),
    );
    expect(mocks.writeSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'OLLAMA_ENABLED',
        value: 'true',
      }),
    );
    expect(mocks.writeSetting).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'OLLAMA_EMBEDDING_MODEL',
        value: 'nomic-embed-text',
      }),
    );
  });

  it('saveEmbeddingsPlatformConfig rejects unknown preferred provider', async () => {
    const result = await saveEmbeddingsPlatformConfig({ preferredProvider: 'not-a-provider' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown provider/);
  });

  it('probeEmbeddings returns dimensions from embed()', async () => {
    mocks.embed.mockResolvedValue(Array.from({ length: 768 }, (_, i) => i));
    const result = await probeEmbeddings();
    expect(result.ok).toBe(true);
    expect(result.dimensions).toBe(768);
    expect(result.active).toBe('ollama');
  });

  it('backfillMissingEmbeddings updates null embedding rows', async () => {
    mocks.embed.mockResolvedValue(Array.from({ length: 768 }, () => 0.1));
    mocks.poolQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'c1', content: 'hello' }, { id: 'c2', content: 'world' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const result = await backfillMissingEmbeddings(10);

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(2);
    expect(result.updated).toBe(2);
    expect(result.remaining).toBe(0);
    expect(mocks.embed).toHaveBeenCalledTimes(2);
  });
});
