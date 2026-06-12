import { llm } from '../brain/llm.js';
import {
  PROVIDER_CAPABILITIES,
  providerDisplayName,
} from '../agents/provider-capabilities.js';
import {
  formatProviderCatalogReply,
  resolveProviderAlias,
} from '../brain/provider-catalog.js';

export interface ProviderOverride {
  name: string;
  model?: string;
}

export interface ModelCommandContext {
  currentOverride?: ProviderOverride;
  applyProviderOverride?: (override: ProviderOverride) => void;
  hasRecentImage?: boolean;
}

export interface ModelCommandResult {
  handled: true;
  reply: string;
}

interface ModelCommandLlm {
  list: () => string[];
  current: () => { name: string };
  use: (provider: string, model?: string) => void;
  currentModel?: () => string;
  modelFor?: (provider: string) => string;
  isKnownProvider?: (provider: string) => boolean;
  isProviderConfigured?: (provider: string) => boolean;
}

const IMAGE_ATTACHMENT_PATTERN = /\[(?:attachment|image):[^\]]+\]|\b\S+\.(?:png|jpe?g|gif|webp|heic|bmp|tiff)\b/i;

export function hasImageAttachment(text: string): boolean {
  return IMAGE_ATTACHMENT_PATTERN.test(text);
}

export function handleModelCommand(
  input: string,
  context: ModelCommandContext = {},
  router: ModelCommandLlm = llm,
): ModelCommandResult {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const command = parts[0]?.toLowerCase();
  if (command !== '/model' && command !== '/provider') {
    return { handled: true, reply: '' };
  }

  const requestedProviderRaw = parts[1]?.toLowerCase();
  const requestedProvider = requestedProviderRaw
    ? resolveProviderAlias(requestedProviderRaw)
    : undefined;
  const requestedModel = parts[2];
  const activeProvider = context.currentOverride?.name ?? safeCurrentProvider(router);
  const activeModel = context.currentOverride?.model ?? modelFor(router, activeProvider);

  if (!requestedProviderRaw && command === '/provider') {
    return {
      handled: true,
      reply: formatProviderCatalogReply({
        currentProvider: activeProvider,
        currentModel: activeModel,
        configuredNames: router.list(),
        preset: 'getPreset' in router && typeof router.getPreset === 'function'
          ? (router as { getPreset: () => string | undefined }).getPreset()
          : undefined,
      }),
    };
  }

  if (!requestedProviderRaw) {
    return {
      handled: true,
      reply: `Current provider: ${providerDisplayName(activeProvider)}. Using ${activeModel}.\nAvailable providers: ${router.list().join(', ')}\nUsage: /model deepseek`,
    };
  }

  if (requestedProviderRaw === 'list') {
    return {
      handled: true,
      reply: formatProviderCatalogReply({
        currentProvider: activeProvider,
        currentModel: activeModel,
        configuredNames: router.list(),
      }),
    };
  }

  if (!isKnownProvider(router, requestedProvider!)) {
    return {
      handled: true,
      reply: `Unknown provider: ${requestedProviderRaw}. Available providers: ${router.list().join(', ')}`,
    };
  }

  if (!isProviderConfigured(router, requestedProvider!)) {
    return {
      handled: true,
      reply: `${providerDisplayName(requestedProvider!)} API key not configured. Run 'carina config set providers.${requestedProvider}.api_key YOUR_KEY'`,
    };
  }

  const model = requestedModel ?? modelFor(router, requestedProvider!);
  switchProvider(router, requestedProvider!, model, context);

  const replies = [`Switched to ${providerDisplayName(requestedProvider!)}. Using ${model}.`];
  const capabilities = PROVIDER_CAPABILITIES[requestedProvider!];
  if (context.hasRecentImage && capabilities && !capabilities.vision) {
    replies.push(`Note: ${providerDisplayName(requestedProvider!)} does not support image analysis. Vision features will be unavailable.`);
  }

  return { handled: true, reply: replies.join('\n') };
}

function switchProvider(
  router: ModelCommandLlm,
  provider: string,
  model: string,
  context: ModelCommandContext,
): void {
  if (context.applyProviderOverride) {
    context.applyProviderOverride({ name: provider, model });
    return;
  }
  router.use(provider, model);
}

function safeCurrentProvider(router: ModelCommandLlm): string {
  try {
    return router.current().name;
  } catch {
    return router.list()[0] ?? 'deepseek';
  }
}

function modelFor(router: ModelCommandLlm, provider: string): string {
  return router.modelFor?.(provider) ?? router.currentModel?.() ?? defaultModelFor(provider);
}

function defaultModelFor(provider: string): string {
  const models: Record<string, string> = {
    deepseek: 'deepseek-chat',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-6',
  };
  return models[provider] ?? '';
}

function isKnownProvider(router: ModelCommandLlm, provider: string): boolean {
  if (router.isKnownProvider) return router.isKnownProvider(provider);
  return provider in PROVIDER_CAPABILITIES || router.list().includes(provider);
}

function isProviderConfigured(router: ModelCommandLlm, provider: string): boolean {
  if (router.isProviderConfigured) return router.isProviderConfigured(provider);
  return router.list().includes(provider);
}
