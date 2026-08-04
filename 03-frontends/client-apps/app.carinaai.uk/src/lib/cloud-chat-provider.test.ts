import { describe, expect, it } from 'vitest';
import {
  filterCloudChatProviderKeys,
  isCloudChatProvider,
  listConfiguredProviders,
  resolveActiveCloudProvider,
} from './cloud-chat-provider';

const keys = [
  { provider: ' OpenAI ', apiKey: 'one' },
  { provider: 'deepseek', apiKey: 'two' },
  { provider: 'openai', apiKey: 'three' },
  { provider: 'labyrinth-scout', apiKey: 'scout' },
  { provider: 'gemini', apiKey: 'gem' },
];

describe('cloud chat provider selection', () => {
  it('normalizes and deduplicates configured providers', () => {
    expect(listConfiguredProviders(keys)).toEqual(['openai', 'deepseek', 'google']);
  });

  it('uses a configured preference and otherwise falls back to DeepSeek', () => {
    expect(resolveActiveCloudProvider(keys, 'openai')).toBe('openai');
    expect(resolveActiveCloudProvider(keys, 'mistral')).toBe('deepseek');
    expect(resolveActiveCloudProvider(keys, 'labyrinth-scout')).toBe('deepseek');
  });

  it('rejects providers unsupported by the direct cloud chat transport', () => {
    expect(isCloudChatProvider('groq')).toBe(true);
    expect(isCloudChatProvider('anthropic')).toBe(false);
    expect(isCloudChatProvider('labyrinth-scout')).toBe(false);
    expect(resolveActiveCloudProvider([{ provider: 'anthropic', apiKey: 'x' }], null)).toBeNull();
    expect(resolveActiveCloudProvider([{ provider: 'labyrinth-scout', apiKey: 'x' }], null)).toBeNull();
  });

  it('filters scout keys out of chat-capable BYOK lists', () => {
    expect(filterCloudChatProviderKeys(keys).map((row) => row.provider)).toEqual([
      'openai',
      'deepseek',
      'openai',
      'google',
    ]);
  });
});
