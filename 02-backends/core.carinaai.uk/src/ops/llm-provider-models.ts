import {
  PROVIDER_MAP,
  isProviderConfigured,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  type ProviderDefinition,
} from '../brain/provider-registry.js';

/**
 * Curated chat model IDs for Ops dropdowns (offline / unconfigured fallback).
 * Live /models fetch replaces this when the provider has credentials.
 */
export const PROVIDER_MODEL_CHOICES: Record<string, string[]> = {
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-v4-flash',
    'deepseek-v3',
    'deepseek-r1',
    'deepseek-coder',
  ],
  openai: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o3-mini',
    'o4-mini',
    'gpt-4-turbo',
  ],
  anthropic: [
    'claude-opus-4',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest',
  ],
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
    'qwen-qwq-32b',
    'deepseek-r1-distill-llama-70b',
  ],
  openrouter: [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-r1',
    'meta-llama/llama-3.3-70b-instruct',
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'codestral-latest',
    'ministral-8b-latest',
    'pixtral-large-latest',
  ],
  together: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
  ],
  cohere: ['command-r-plus-08-2024', 'command-r-08-2024', 'command-a-03-2025'],
  perplexity: ['sonar-pro', 'sonar', 'sonar-reasoning-pro'],
  fireworks: [
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
    'accounts/fireworks/models/llama-v3p1-8b-instruct',
    'accounts/fireworks/models/deepseek-v3',
    'accounts/fireworks/models/qwen2p5-72b-instruct',
  ],
  xai: ['grok-2-latest', 'grok-2-vision-latest', 'grok-3', 'grok-3-mini'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen2.5-72b-instruct'],
  zhipu: ['glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-4-air', 'glm-z1-flash'],
  azure: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
  bedrock: [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'amazon.titan-text-express-v1',
  ],
  'bedrock-mantle': ['amazon.titan-text-express-v1'],
  cerebras: ['llama-3.3-70b', 'llama3.1-8b', 'llama3.1-70b'],
  deepinfra: [
    'meta-llama/Llama-3.3-70B-Instruct',
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'deepseek-ai/DeepSeek-V3',
  ],
  novita: ['deepseek/deepseek-r1', 'deepseek/deepseek-v3', 'meta-llama/llama-3.3-70b-instruct'],
  siliconflow: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Meta-Llama-3.1-8B-Instruct'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'gemma2', 'phi3', 'deepseek-r1'],
  lmstudio: ['local-model'],
  vllm: ['default'],
  nvidia: ['nemotron-mini-4b-instruct', 'meta/llama-3.1-70b-instruct', 'meta/llama-3.1-8b-instruct'],
  huggingface: [
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'Qwen/Qwen2.5-72B-Instruct',
  ],
  minimax: ['MiniMax-Text-01', 'MiniMax-M1'],
  'minimax-cn': ['MiniMax-Text-01', 'MiniMax-M1'],
  'xiaomi-mimo': ['MiMo-7B-RL'],
  'llama-cpp': ['default'],
  custom: ['default'],
  litellm: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet'],
  sglang: ['default'],
  vertex: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  'cloudflare-ai-gateway': ['gpt-4o-mini', 'gpt-4o'],
  byteplus: ['skylark-pro', 'skylark-lite'],
  tencent: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro'],
  volcengine: ['doubao-pro-32k', 'doubao-lite-32k'],
  'nous-portal': ['default'],
};

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function looksLikeChatModel(id: string, provider: string): boolean {
  const lower = id.toLowerCase();
  if (!lower) return false;
  if (/(embed|embedding|whisper|tts|audio|moderation|dall-e|image|video|realtime|transcribe)/i.test(lower)) {
    return false;
  }
  if (provider === 'gemini' && !lower.includes('gemini')) return false;
  return true;
}

/** Suggested model IDs for a provider, including registry default and optional current value. */
export function suggestedModelsForProvider(
  provider: string,
  currentModel?: string | null,
): string[] {
  const key = provider.trim().toLowerCase();
  const def = PROVIDER_MAP[key];
  const curated = PROVIDER_MODEL_CHOICES[key] ?? [];
  return uniquePreserveOrder([
    ...(currentModel ? [currentModel] : []),
    def?.defaultModel ?? '',
    ...curated,
  ]);
}

async function fetchOpenAiCompatibleModels(def: ProviderDefinition): Promise<string[]> {
  const base = providerBaseUrl(def);
  if (!base) return [];
  const apiKey = providerApiKey(def);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${base.replace(/\/$/, '')}/models`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, unknown>;
  const raw = data.data ?? data.models ?? data;
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((row) => String(row.id ?? row.name ?? '').trim())
    .filter((id) => looksLikeChatModel(id, def.name));
}

async function fetchAnthropicModels(def: ProviderDefinition): Promise<string[]> {
  const apiKey = providerApiKey(def);
  if (!apiKey) return [];
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return (data.data ?? [])
    .map((row) => String(row.id ?? '').trim())
    .filter((id) => looksLikeChatModel(id, 'anthropic'));
}

async function fetchGeminiModels(def: ProviderDefinition): Promise<string[]> {
  const apiKey = providerApiKey(def);
  if (!apiKey) return [];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
  return (data.models ?? [])
    .filter((row) => (row.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((row) => String(row.name ?? '').replace(/^models\//, '').trim())
    .filter((id) => looksLikeChatModel(id, 'gemini'));
}

async function fetchOllamaTags(def: ProviderDefinition): Promise<string[]> {
  const base = providerBaseUrl(def).replace(/\/v1\/?$/, '') || 'http://127.0.0.1:11434';
  const res = await fetch(`${base.replace(/\/$/, '')}/api/tags`, {
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
  return (data.models ?? [])
    .map((row) => String(row.name ?? row.model ?? '').trim())
    .filter(Boolean);
}

/** Providers whose /models catalog is public (no API key required for listing). */
const PUBLIC_MODEL_CATALOG = new Set(['openrouter']);

/** Live model IDs from the provider API; public catalogs work without credentials. */
export async function fetchLiveModelsForProvider(provider: string): Promise<string[]> {
  const key = provider.trim().toLowerCase();
  const def = PROVIDER_MAP[key];
  if (!def) return [];
  const configured = isProviderConfigured(def);
  const allowUnauthed = PUBLIC_MODEL_CATALOG.has(key) || Boolean(def.local);
  if (!configured && !allowUnauthed) return [];

  try {
    if (def.kind === 'anthropic') {
      if (!configured) return [];
      return await fetchAnthropicModels(def);
    }
    if (def.kind === 'gemini') {
      if (!configured) return [];
      return await fetchGeminiModels(def);
    }
    if (key === 'ollama') {
      const tags = await fetchOllamaTags(def);
      if (tags.length > 0) return tags;
    }
    if (def.kind === 'openai' || def.local || PUBLIC_MODEL_CATALOG.has(key)) {
      return await fetchOpenAiCompatibleModels(def);
    }
  } catch {
    return [];
  }
  return [];
}

export type ProviderModelListResult = {
  provider: string;
  models: string[];
  source: 'live' | 'curated' | 'mixed';
  configured: boolean;
  currentModel: string | null;
};

/** Merge live API models with curated fallbacks for Ops UI. */
export async function listModelsForProvider(provider: string): Promise<ProviderModelListResult> {
  const key = provider.trim().toLowerCase();
  const def = PROVIDER_MAP[key];
  const configured = Boolean(def && isProviderConfigured(def));
  const currentModel = def ? providerModel(def) : null;
  const curated = suggestedModelsForProvider(key, currentModel);
  const live = await fetchLiveModelsForProvider(key);
  const models = uniquePreserveOrder([
    ...(currentModel ? [currentModel] : []),
    ...live,
    ...curated,
  ]);
  return {
    provider: key,
    models,
    source: live.length > 0 ? (curated.length > 0 ? 'mixed' : 'live') : 'curated',
    configured,
    currentModel,
  };
}
