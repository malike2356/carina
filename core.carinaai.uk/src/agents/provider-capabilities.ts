import {
  buildProviderCapabilitiesMap,
  buildProviderDisplayNames,
} from '../brain/provider-registry.js';

export interface ProviderCapabilities {
  chat: boolean;
  vision: boolean;
  streaming: boolean;
  tools: boolean;
  reasoning?: boolean;
  /** Provider can accept reasoning-effort or thinking-budget controls on supported models. */
  reasoningEffort?: boolean;
  /** Embeddings API (not chat-routable when chat is false). */
  embeddings?: boolean;
  /** Tool call deltas stream alongside text (when streaming + tools). */
  streamingTools?: boolean;
}

export const PROVIDER_CAPABILITIES = buildProviderCapabilitiesMap();

export function providerDisplayName(provider: string): string {
  const names = buildProviderDisplayNames();
  return names[provider] ?? provider;
}
