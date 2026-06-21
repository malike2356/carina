import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CarinaCliConfig } from '../cli/config/defaults.js';

const loadFromYamlSync = vi.fn<() => CarinaCliConfig>();
const llmChat = vi.fn();

vi.mock('../cli/config/loader.js', () => ({
  loadFromYamlSync: () => loadFromYamlSync(),
}));

vi.mock('./llm.js', () => ({
  llm: {
    current: () => ({ name: 'deepseek' }),
    currentModel: () => 'deepseek-chat',
    chat: (...args: unknown[]) => llmChat(...args),
  },
}));

describe('auxiliary-client', () => {
  beforeEach(() => {
    loadFromYamlSync.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      dataDir: '~/.carina',
      scout: { enabled: false, url: '' },
      providers: {
        deepseek: { model: 'deepseek-chat' },
        anthropic: { model: 'claude-sonnet-4-6' },
        openai: { model: 'gpt-4o' },
      },
    });
    llmChat.mockReset();
    delete process.env.DEFAULT_PROVIDER;
    delete process.env.DEFAULT_MODEL;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolveAuxiliaryConfig returns primary model when no override set', async () => {
    const { resolveAuxiliaryConfig } = await import('./auxiliary-client.js');
    const cfg = resolveAuxiliaryConfig('curator');
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.model).toBe('claude-sonnet-4-6');
  });

  it('resolveAuxiliaryConfig returns task override when configured', async () => {
    loadFromYamlSync.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      dataDir: '~/.carina',
      scout: { enabled: false, url: '' },
      providers: {
        deepseek: { model: 'deepseek-chat' },
        anthropic: { model: 'claude-sonnet-4-6' },
        openai: { model: 'gpt-4o' },
      },
      auxiliaryModels: {
        curator: { model: 'claude-haiku-4-5-20251001', maxTokens: 256 },
      },
    });
    const { resolveAuxiliaryConfig } = await import('./auxiliary-client.js');
    const cfg = resolveAuxiliaryConfig('curator');
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.model).toBe('claude-haiku-4-5-20251001');
    expect(cfg.maxTokens).toBe(256);
  });

  it('callAuxiliaryModel routes to configured provider', async () => {
    loadFromYamlSync.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      dataDir: '~/.carina',
      scout: { enabled: false, url: '' },
      providers: {
        deepseek: { model: 'deepseek-chat' },
        anthropic: { model: 'claude-sonnet-4-6' },
        openai: { model: 'gpt-4o' },
      },
      auxiliaryModels: {
        titleGeneration: { provider: 'groq', model: 'llama-3.1-8b-instant' },
      },
    });
    llmChat.mockResolvedValue({ content: 'Deploy checklist review' });
    const { callAuxiliaryModel } = await import('./auxiliary-client.js');
    const out = await callAuxiliaryModel('titleGeneration', 'Title this chat');
    expect(out).toBe('Deploy checklist review');
    expect(llmChat).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      { name: 'groq', model: 'llama-3.1-8b-instant' },
    );
  });

  it('missing auxiliaryModels key does not throw', async () => {
    llmChat.mockResolvedValue({ content: 'ok' });
    const { callAuxiliaryModel } = await import('./auxiliary-client.js');
    await expect(callAuxiliaryModel('sessionSearch', 'summarize')).resolves.toBe('ok');
  });

  it('falls back to primary model when auxiliary provider call fails', async () => {
    loadFromYamlSync.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      dataDir: '~/.carina',
      scout: { enabled: false, url: '' },
      providers: {
        deepseek: { model: 'deepseek-chat' },
        anthropic: { model: 'claude-sonnet-4-6' },
        openai: { model: 'gpt-4o' },
      },
      auxiliaryModels: {
        curator: { provider: 'groq', model: 'llama-3.1-8b-instant' },
      },
    });
    llmChat
      .mockRejectedValueOnce(new Error('groq unavailable'))
      .mockResolvedValueOnce({ content: 'fallback ok' });
    const { callAuxiliaryModel } = await import('./auxiliary-client.js');
    const out = await callAuxiliaryModel('curator', 'evaluate skill');
    expect(out).toBe('fallback ok');
    expect(llmChat).toHaveBeenCalledTimes(2);
    expect(llmChat.mock.calls[1]?.[2]).toEqual({ name: 'anthropic', model: 'claude-sonnet-4-6' });
  });
});
