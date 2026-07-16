import { describe, expect, it } from 'vitest';
import {
  isCloudChatProvider,
  listConfiguredProviders,
  resolveActiveCloudProvider,
} from './cloud-chat-provider';

const keys = [
  { provider: ' OpenAI ', apiKey: 'one' },
  { provider: 'deepseek', apiKey: 'two' },
  { provider: 'openai', apiKey: 'three' },
];

describe('cloud chat provider selection', () => {
  it('normalizes and deduplicates configured providers', () => {
    expect(listConfiguredProviders(keys)).toEqual(['openai', 'deepseek']);
  });

  it('uses a configured preference and otherwise falls back to DeepSeek', () => {
    expect(resolveActiveCloudProvider(keys, 'openai')).toBe('openai');
    expect(resolveActiveCloudProvider(keys, 'mistral')).toBe('deepseek');
  });

  it('rejects providers unsupported by the direct cloud chat transport', () => {
    expect(isCloudChatProvider('groq')).toBe(true);
    expect(isCloudChatProvider('anthropic')).toBe(false);
    expect(resolveActiveCloudProvider([{ provider: 'anthropic', apiKey: 'x' }], null)).toBeNull();
  });
});
