import type { ProviderCapabilities } from '../agents/provider-capabilities.js';

export type ProviderKind = 'openai' | 'anthropic' | 'gemini';

export interface ProviderDefinition {
  name: string;
  displayName: string;
  kind: ProviderKind;
  apiKeyEnv: string;
  apiKeysPoolEnv: string;
  modelEnv: string;
  defaultModel: string;
  baseUrl?: string;
  baseUrlEnv?: string;
  local?: boolean;
  capabilities: ProviderCapabilities;
  usdPerToken: number;
  fallbackPriority: number;
}

function openaiCompat(
  name: string,
  displayName: string,
  apiKeyEnv: string,
  modelEnv: string,
  defaultModel: string,
  baseUrl: string,
  baseUrlEnv: string,
  usdPerToken: number,
  priority: number,
  extras: Partial<ProviderDefinition> = {},
): ProviderDefinition {
  return {
    name,
    displayName,
    kind: 'openai',
    apiKeyEnv,
    apiKeysPoolEnv: `${apiKeyEnv}S`,
    modelEnv,
    defaultModel,
    baseUrl,
    baseUrlEnv,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    usdPerToken,
    fallbackPriority: priority,
    ...extras,
  };
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  openaiCompat('deepseek', 'DeepSeek', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'deepseek-chat', 'https://api.deepseek.com/v1', 'DEEPSEEK_BASE_URL', 0.00000028, 1),
  openaiCompat('groq', 'Groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1', 'GROQ_BASE_URL', 0.00000059, 2),
  {
    name: 'gemini',
    displayName: 'Gemini',
    kind: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    apiKeysPoolEnv: 'GEMINI_API_KEYS',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',
    capabilities: { chat: true, vision: true, streaming: true, tools: false },
    usdPerToken: 0.00000035,
    fallbackPriority: 3,
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    kind: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeysPoolEnv: 'ANTHROPIC_API_KEYS',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-4-6',
    capabilities: { chat: true, vision: true, streaming: true, tools: true },
    usdPerToken: 0.000009,
    fallbackPriority: 4,
  },
  openaiCompat('openai', 'OpenAI', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'gpt-4o', 'https://api.openai.com/v1', 'OPENAI_BASE_URL', 0.0000075, 5, {
    capabilities: { chat: true, vision: true, streaming: true, tools: true },
  }),
  openaiCompat('openrouter', 'OpenRouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'anthropic/claude-sonnet-4', 'https://openrouter.ai/api/v1', 'OPENROUTER_BASE_URL', 0.000003, 6),
  openaiCompat('together', 'Together AI', 'TOGETHER_API_KEY', 'TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'https://api.together.xyz/v1', 'TOGETHER_BASE_URL', 0.00000088, 7),
  openaiCompat('mistral', 'Mistral', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'mistral-large-latest', 'https://api.mistral.ai/v1', 'MISTRAL_BASE_URL', 0.000002, 8),
  openaiCompat('cohere', 'Cohere', 'COHERE_API_KEY', 'COHERE_MODEL', 'command-r-plus-08-2024', 'https://api.cohere.com/compatibility/v1', 'COHERE_BASE_URL', 0.000003, 9),
  openaiCompat('perplexity', 'Perplexity', 'PERPLEXITY_API_KEY', 'PERPLEXITY_MODEL', 'sonar-pro', 'https://api.perplexity.ai', 'PERPLEXITY_BASE_URL', 0.000003, 10),
  openaiCompat('fireworks', 'Fireworks', 'FIREWORKS_API_KEY', 'FIREWORKS_MODEL', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'https://api.fireworks.ai/inference/v1', 'FIREWORKS_BASE_URL', 0.0000009, 11),
  openaiCompat('xai', 'xAI', 'XAI_API_KEY', 'XAI_MODEL', 'grok-2-latest', 'https://api.x.ai/v1', 'XAI_BASE_URL', 0.000005, 12),
  openaiCompat('moonshot', 'Moonshot', 'MOONSHOT_API_KEY', 'MOONSHOT_MODEL', 'moonshot-v1-8k', 'https://api.moonshot.cn/v1', 'MOONSHOT_BASE_URL', 0.0000012, 13),
  openaiCompat('qwen', 'Qwen', 'DASHSCOPE_API_KEY', 'QWEN_MODEL', 'qwen-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'QWEN_BASE_URL', 0.0000008, 14),
  openaiCompat('zhipu', 'Zhipu GLM', 'ZHIPU_API_KEY', 'ZHIPU_MODEL', 'glm-4-flash', 'https://open.bigmodel.cn/api/paas/v4', 'ZHIPU_BASE_URL', 0.000001, 15),
  openaiCompat('azure', 'Azure OpenAI', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_MODEL', 'gpt-4o', '', 'AZURE_OPENAI_BASE_URL', 0.0000075, 16),
  openaiCompat('cerebras', 'Cerebras', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'llama-3.3-70b', 'https://api.cerebras.ai/v1', 'CEREBRAS_BASE_URL', 0.0000006, 17),
  openaiCompat('deepinfra', 'DeepInfra', 'DEEPINFRA_API_KEY', 'DEEPINFRA_MODEL', 'meta-llama/Llama-3.3-70B-Instruct', 'https://api.deepinfra.com/v1/openai', 'DEEPINFRA_BASE_URL', 0.0000004, 18),
  openaiCompat('novita', 'Novita', 'NOVITA_API_KEY', 'NOVITA_MODEL', 'deepseek/deepseek-r1', 'https://api.novita.ai/v3/openai', 'NOVITA_BASE_URL', 0.0000005, 19),
  openaiCompat('siliconflow', 'SiliconFlow', 'SILICONFLOW_API_KEY', 'SILICONFLOW_MODEL', 'deepseek-ai/DeepSeek-V3', 'https://api.siliconflow.cn/v1', 'SILICONFLOW_BASE_URL', 0.0000004, 20),
  openaiCompat('ollama', 'Ollama', 'OLLAMA_API_KEY', 'OLLAMA_MODEL', 'llama3.2', 'http://127.0.0.1:11434/v1', 'OLLAMA_BASE_URL', 0, 21, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
  }),
  openaiCompat('lmstudio', 'LM Studio', 'LMSTUDIO_API_KEY', 'LMSTUDIO_MODEL', 'local-model', 'http://127.0.0.1:1234/v1', 'LMSTUDIO_BASE_URL', 0, 22, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
  }),
  openaiCompat('nvidia', 'NVIDIA NIM', 'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'nemotron-mini-4b-instruct', 'https://integrate.api.nvidia.com/v1', 'NVIDIA_BASE_URL', 0, 23, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
  }),
];

export const PROVIDER_MAP = Object.fromEntries(
  PROVIDER_DEFINITIONS.map((d) => [d.name, d]),
) as Record<string, ProviderDefinition>;

export type ProviderName = (typeof PROVIDER_DEFINITIONS)[number]['name'];

export const KNOWN_LLM_PROVIDERS = PROVIDER_DEFINITIONS.map((d) => d.name) as ProviderName[];

export function providerApiKey(def: ProviderDefinition): string {
  return process.env[def.apiKeyEnv] ?? '';
}

export function providerBaseUrl(def: ProviderDefinition): string {
  if (def.baseUrlEnv && process.env[def.baseUrlEnv]) {
    return String(process.env[def.baseUrlEnv]).replace(/\/$/, '');
  }
  return (def.baseUrl ?? '').replace(/\/$/, '');
}

export function providerModel(def: ProviderDefinition): string {
  return process.env[def.modelEnv] ?? def.defaultModel;
}

export function isProviderConfigured(def: ProviderDefinition): boolean {
  if (def.local) {
    const flag = process.env[`${def.name.toUpperCase()}_ENABLED`] === 'true'
      || process.env.CARINA_LOCAL_LLM_ENABLED === 'true';
    return flag && Boolean(providerBaseUrl(def));
  }
  if (def.name === 'azure') {
    return Boolean(providerApiKey(def) && providerBaseUrl(def));
  }
  const key = providerApiKey(def);
  if (key) return true;
  const pool = process.env[def.apiKeysPoolEnv];
  return Boolean(pool && pool.trim());
}

export function buildProviderCapabilitiesMap(): Record<string, ProviderCapabilities> {
  const out: Record<string, ProviderCapabilities> = {};
  for (const def of PROVIDER_DEFINITIONS) {
    out[def.name] = def.capabilities;
  }
  return out;
}

export function buildProviderDisplayNames(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of PROVIDER_DEFINITIONS) {
    out[def.name] = def.displayName;
  }
  return out;
}

export function buildUsdPerTokenMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of PROVIDER_DEFINITIONS) {
    out[def.name] = def.usdPerToken;
  }
  return out;
}

export function fallbackOrderNames(): string[] {
  return [...PROVIDER_DEFINITIONS]
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority)
    .map((d) => d.name);
}
