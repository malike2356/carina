export interface ProviderCapabilities {
  chat: boolean;
  vision: boolean;
  streaming: boolean;
  tools: boolean;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  deepseek: { chat: true, vision: false, streaming: true, tools: true },
  openai: { chat: true, vision: true, streaming: true, tools: true },
  anthropic: { chat: true, vision: true, streaming: true, tools: true },
};

export function providerDisplayName(provider: string): string {
  const names: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
  };
  return names[provider] ?? provider;
}
