import { describe, expect, it, vi } from 'vitest';
import { handleModelCommand } from './model-command.js';

function makeRouter(options: {
  providers?: string[];
  known?: string[];
  current?: string;
  models?: Record<string, string>;
} = {}) {
  const providers = options.providers ?? ['deepseek', 'openai'];
  const known = options.known ?? ['deepseek', 'openai', 'anthropic'];
  const models = options.models ?? {
    deepseek: 'deepseek-chat',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-6',
  };
  const state = { active: options.current ?? providers[0] ?? 'deepseek' };

  return {
    state,
    router: {
      list: () => providers,
      current: () => ({ name: state.active }),
      use: vi.fn((provider: string) => {
        state.active = provider;
      }),
      currentModel: () => models[state.active] ?? '',
      modelFor: (provider: string) => models[provider] ?? '',
      isKnownProvider: (provider: string) => known.includes(provider),
      isProviderConfigured: (provider: string) => providers.includes(provider),
    },
  };
}

describe('handleModelCommand', () => {
  it('/model with no args returns the current provider and model', () => {
    const { router } = makeRouter({ current: 'openai' });

    const result = handleModelCommand('/model', {}, router);

    expect(result.reply).toContain('Current provider: OpenAI. Using gpt-4o.');
  });

  it('/model list returns the same list as the existing /provider command', () => {
    const { router } = makeRouter();

    const modelList = handleModelCommand('/model list', {}, router);
    const providerList = handleModelCommand('/provider', {}, router);

    expect(modelList.reply.split('\n')[0]).toBe(providerList.reply.split('\n')[0]);
    expect(modelList.reply).toContain('deepseek, openai');
  });

  it('/model openai switches and returns the confirmation string', () => {
    const { router } = makeRouter();

    const result = handleModelCommand('/model openai', {}, router);

    expect(router.use).toHaveBeenCalledWith('openai', 'gpt-4o');
    expect(result.reply).toBe('Switched to OpenAI. Using gpt-4o.');
  });

  it('/model badname returns an unknown provider message, not a crash', () => {
    const { router } = makeRouter();

    const result = handleModelCommand('/model badname', {}, router);

    expect(result.reply).toContain('Unknown provider: badname');
  });

  it('switching to a non-vision provider after an image returns the vision warning', () => {
    const { router } = makeRouter();

    const result = handleModelCommand('/model deepseek', { hasRecentImage: true }, router);

    expect(result.reply).toContain('Switched to DeepSeek. Using deepseek-chat.');
    expect(result.reply).toContain('Note: DeepSeek does not support image analysis. Vision features will be unavailable.');
  });

  it('missing API key returns the exact config-set hint string', () => {
    const { router } = makeRouter({ providers: ['deepseek'] });

    const result = handleModelCommand('/model openai', {}, router);

    expect(result.reply).toBe("OpenAI API key not configured. Run 'carina config set providers.openai.api_key YOUR_KEY'");
  });

  it('uses the session override callback when provided', () => {
    const { router } = makeRouter();
    const applyProviderOverride = vi.fn();

    const result = handleModelCommand('/model openai gpt-4.1', { applyProviderOverride }, router);

    expect(router.use).not.toHaveBeenCalled();
    expect(applyProviderOverride).toHaveBeenCalledWith({ name: 'openai', model: 'gpt-4.1' });
    expect(result.reply).toBe('Switched to OpenAI. Using gpt-4.1.');
  });
});
