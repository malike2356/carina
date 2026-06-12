import type { ProviderCapabilities } from '../agents/provider-capabilities.js';
import { buildRoutingTags, type ProviderRoutingTags } from './provider-tags.js';

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'external-cli' | 'alias' | 'oauth';

/** Wire protocol / adapter used to reach the provider. */
export type ProviderTransportType =
  | 'openai-compatible'
  | 'anthropic-messages'
  | 'google-generative'
  | 'external-cli'
  | 'oauth'
  | 'alias';

export function providerTransportType(def: Pick<ProviderDefinition, 'kind'>): ProviderTransportType {
  switch (def.kind) {
    case 'anthropic': return 'anthropic-messages';
    case 'gemini': return 'google-generative';
    case 'external-cli': return 'external-cli';
    case 'oauth': return 'oauth';
    case 'alias': return 'alias';
    default: return 'openai-compatible';
  }
}

/**
 * active       - fully integrated, routes via LLMRouter now
 * experimental - adapter exists, not production-hardened
 * alias        - display alias; routes to another provider (aliasFor required)
 * external-cli - requires an external CLI tool; cannot route via LLMRouter
 * oauth        - requires an OAuth flow, not an API key
 * unsupported  - known in catalog, no implementation path yet
 */
export type ProviderStatus = 'active' | 'experimental' | 'alias' | 'external-cli' | 'oauth' | 'unsupported';

export type ProviderAuthType = 'api-key' | 'oauth' | 'external-cli' | 'local' | 'none';

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
  tags: ProviderRoutingTags;
  usdPerToken: number;
  fallbackPriority: number;
  status: ProviderStatus;
  authType: ProviderAuthType;
  aliasFor?: string;
  setupNote?: string;
}

function deriveAuthType(
  local: boolean | undefined,
  kind: ProviderKind,
  status: ProviderStatus,
): ProviderAuthType {
  if (status === 'external-cli') return 'external-cli';
  if (status === 'oauth') return 'oauth';
  if (status === 'alias') return 'api-key';
  if (local) return 'local';
  return 'api-key';
}

type OpenAICompatExtras = Partial<Omit<ProviderDefinition, 'tags'>> & {
  tags?: Partial<ProviderRoutingTags>;
};

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
  extras: OpenAICompatExtras = {},
): ProviderDefinition {
  const capabilities = extras.capabilities ?? { chat: true, vision: false, streaming: true, tools: true };
  const status = (extras.status ?? 'active') as ProviderStatus;
  const local = extras.local;
  const skeleton = { name, local, fallbackPriority: priority, capabilities, usdPerToken };
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
    capabilities,
    usdPerToken,
    fallbackPriority: priority,
    status,
    authType: deriveAuthType(local, 'openai', status),
    ...extras,
    tags: buildRoutingTags(skeleton, extras.tags),
  };
}

type NativeExtras = Omit<ProviderDefinition, 'tags' | 'status' | 'authType'> & {
  tags?: Partial<ProviderRoutingTags>;
  status?: ProviderStatus;
  authType?: ProviderAuthType;
};

function nativeProvider(def: NativeExtras): ProviderDefinition {
  const { tags: tagOverrides, status, authType, ...rest } = def;
  const resolvedStatus = status ?? 'active';
  const resolvedAuthType = authType ?? deriveAuthType(rest.local, rest.kind, resolvedStatus);
  return {
    ...rest,
    status: resolvedStatus,
    authType: resolvedAuthType,
    tags: buildRoutingTags(rest, tagOverrides),
  };
}

function externalCliEntry(
  name: string,
  displayName: string,
  apiKeyEnv: string,
  setupNote: string,
  priority = 99,
): ProviderDefinition {
  return {
    name,
    displayName,
    kind: 'external-cli',
    apiKeyEnv,
    apiKeysPoolEnv: `${apiKeyEnv}S`,
    modelEnv: `${name.toUpperCase().replace(/-/g, '_')}_MODEL`,
    defaultModel: 'external-cli',
    capabilities: { chat: true, vision: false, streaming: false, tools: false },
    usdPerToken: 0,
    fallbackPriority: priority,
    status: 'external-cli',
    authType: 'external-cli',
    setupNote,
    tags: buildRoutingTags(
      { name, local: false, fallbackPriority: priority, capabilities: { chat: true, vision: false, streaming: false, tools: false }, usdPerToken: 0 },
      { cost: 'external-cli', speed: 'balanced', chat: true, code: false, vision: false, longContext: false, toolUse: false },
    ),
  };
}

function oauthEntry(
  name: string,
  displayName: string,
  apiKeyEnv: string,
  setupNote: string,
  aliasFor?: string,
  priority = 99,
): ProviderDefinition {
  return {
    name,
    displayName,
    kind: 'oauth',
    apiKeyEnv,
    apiKeysPoolEnv: `${apiKeyEnv}S`,
    modelEnv: `${name.toUpperCase().replace(/-/g, '_')}_MODEL`,
    defaultModel: aliasFor ?? 'oauth',
    capabilities: { chat: true, vision: false, streaming: false, tools: false },
    usdPerToken: 0,
    fallbackPriority: priority,
    status: 'oauth',
    authType: 'oauth',
    aliasFor,
    setupNote,
    tags: buildRoutingTags(
      { name, local: false, fallbackPriority: priority, capabilities: { chat: true, vision: false, streaming: false, tools: false }, usdPerToken: 0 },
      { cost: 'oauth', speed: 'balanced', chat: true, code: false, vision: false, longContext: false, toolUse: false },
    ),
  };
}

function aliasEntry(
  name: string,
  displayName: string,
  aliasFor: string,
  priority = 99,
): ProviderDefinition {
  return {
    name,
    displayName,
    kind: 'alias',
    apiKeyEnv: `${name.toUpperCase().replace(/-/g, '_')}_API_KEY`,
    apiKeysPoolEnv: `${name.toUpperCase().replace(/-/g, '_')}_API_KEYS`,
    modelEnv: `${name.toUpperCase().replace(/-/g, '_')}_MODEL`,
    defaultModel: aliasFor,
    capabilities: { chat: true, vision: false, streaming: true, tools: false },
    usdPerToken: 0,
    fallbackPriority: priority,
    status: 'alias',
    authType: 'api-key',
    aliasFor,
    setupNote: `Use provider "${aliasFor}" directly. This is a catalog alias.`,
    tags: buildRoutingTags(
      { name, local: false, fallbackPriority: priority, capabilities: { chat: true, vision: false, streaming: true, tools: false }, usdPerToken: 0 },
      { cost: 'byo-key', speed: 'balanced', chat: true, code: false, vision: false, longContext: false, toolUse: false },
    ),
  };
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  /* ── NATIVE INTEGRATIONS ── */
  openaiCompat('deepseek', 'DeepSeek', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'deepseek-chat', 'https://api.deepseek.com/v1', 'DEEPSEEK_BASE_URL', 0.00000028, 1, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true, reasoning: true },
  }),
  openaiCompat('groq', 'Groq', 'GROQ_API_KEY', 'GROQ_MODEL', 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1', 'GROQ_BASE_URL', 0.00000059, 2),
  nativeProvider({
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
    tags: { speed: 'fast', toolUse: false, code: false },
  }),
  nativeProvider({
    name: 'anthropic',
    displayName: 'Anthropic',
    kind: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiKeysPoolEnv: 'ANTHROPIC_API_KEYS',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-4-6',
    capabilities: { chat: true, vision: true, streaming: true, tools: true, reasoning: true },
    usdPerToken: 0.000009,
    fallbackPriority: 4,
    tags: { speed: 'balanced' },
  }),
  openaiCompat('openai', 'OpenAI', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'gpt-4o', 'https://api.openai.com/v1', 'OPENAI_BASE_URL', 0.0000075, 5, {
    capabilities: { chat: true, vision: true, streaming: true, tools: true, reasoning: true },
  }),
  openaiCompat('openrouter', 'OpenRouter', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'anthropic/claude-sonnet-4', 'https://openrouter.ai/api/v1', 'OPENROUTER_BASE_URL', 0.000003, 6, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true, reasoning: true },
  }),
  openaiCompat('together', 'Together AI', 'TOGETHER_API_KEY', 'TOGETHER_MODEL', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'https://api.together.xyz/v1', 'TOGETHER_BASE_URL', 0.00000088, 7),
  openaiCompat('mistral', 'Mistral', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'mistral-large-latest', 'https://api.mistral.ai/v1', 'MISTRAL_BASE_URL', 0.000002, 8),
  openaiCompat('cohere', 'Cohere', 'COHERE_API_KEY', 'COHERE_MODEL', 'command-r-plus-08-2024', 'https://api.cohere.com/compatibility/v1', 'COHERE_BASE_URL', 0.000003, 9),
  openaiCompat('perplexity', 'Perplexity', 'PERPLEXITY_API_KEY', 'PERPLEXITY_MODEL', 'sonar-pro', 'https://api.perplexity.ai', 'PERPLEXITY_BASE_URL', 0.000003, 10),
  openaiCompat('fireworks', 'Fireworks', 'FIREWORKS_API_KEY', 'FIREWORKS_MODEL', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'https://api.fireworks.ai/inference/v1', 'FIREWORKS_BASE_URL', 0.0000009, 11),
  openaiCompat('xai', 'xAI / Grok', 'XAI_API_KEY', 'XAI_MODEL', 'grok-2-latest', 'https://api.x.ai/v1', 'XAI_BASE_URL', 0.000005, 12),
  openaiCompat('moonshot', 'Moonshot (Kimi)', 'MOONSHOT_API_KEY', 'MOONSHOT_MODEL', 'moonshot-v1-8k', 'https://api.moonshot.cn/v1', 'MOONSHOT_BASE_URL', 0.0000012, 13),
  openaiCompat('qwen', 'Qwen / DashScope', 'DASHSCOPE_API_KEY', 'QWEN_MODEL', 'qwen-plus', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'QWEN_BASE_URL', 0.0000008, 14),
  openaiCompat('zhipu', 'Zhipu GLM (Z.AI)', 'ZHIPU_API_KEY', 'ZHIPU_MODEL', 'glm-4-flash', 'https://open.bigmodel.cn/api/paas/v4', 'ZHIPU_BASE_URL', 0.000001, 15),
  openaiCompat('azure', 'Azure OpenAI', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_MODEL', 'gpt-4o', '', 'AZURE_OPENAI_BASE_URL', 0.0000075, 16),
  openaiCompat('bedrock', 'Amazon Bedrock', 'BEDROCK_API_KEY', 'BEDROCK_MODEL', 'anthropic.claude-3-5-sonnet-20241022-v2:0', '', 'BEDROCK_BASE_URL', 0.000003, 16, {
    status: 'experimental',
    capabilities: { chat: true, vision: false, streaming: true, tools: true, reasoning: true },
    setupNote: 'OpenAI-compatible Bedrock proxy or gateway. Set BEDROCK_BASE_URL and AWS credentials (or proxy token).',
    tags: { cost: 'byo-key', speed: 'balanced' },
  }),
  openaiCompat('cerebras', 'Cerebras', 'CEREBRAS_API_KEY', 'CEREBRAS_MODEL', 'llama-3.3-70b', 'https://api.cerebras.ai/v1', 'CEREBRAS_BASE_URL', 0.0000006, 17),
  openaiCompat('deepinfra', 'DeepInfra', 'DEEPINFRA_API_KEY', 'DEEPINFRA_MODEL', 'meta-llama/Llama-3.3-70B-Instruct', 'https://api.deepinfra.com/v1/openai', 'DEEPINFRA_BASE_URL', 0.0000004, 18),
  openaiCompat('novita', 'Novita', 'NOVITA_API_KEY', 'NOVITA_MODEL', 'deepseek/deepseek-r1', 'https://api.novita.ai/v3/openai', 'NOVITA_BASE_URL', 0.0000005, 19, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true, reasoning: true },
  }),
  openaiCompat('siliconflow', 'SiliconFlow', 'SILICONFLOW_API_KEY', 'SILICONFLOW_MODEL', 'deepseek-ai/DeepSeek-V3', 'https://api.siliconflow.cn/v1', 'SILICONFLOW_BASE_URL', 0.0000004, 20, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true, reasoning: true },
  }),
  openaiCompat('ollama', 'Ollama', 'OLLAMA_API_KEY', 'OLLAMA_MODEL', 'llama3.2', 'http://127.0.0.1:11434/v1', 'OLLAMA_BASE_URL', 0, 21, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'local', speed: 'fast' },
  }),
  openaiCompat('lmstudio', 'LM Studio', 'LMSTUDIO_API_KEY', 'LMSTUDIO_MODEL', 'local-model', 'http://127.0.0.1:1234/v1', 'LMSTUDIO_BASE_URL', 0, 22, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'local', speed: 'fast' },
  }),
  openaiCompat('vllm', 'vLLM', 'VLLM_API_KEY', 'VLLM_MODEL', 'default', 'http://127.0.0.1:8000/v1', 'VLLM_BASE_URL', 0, 23, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'local', speed: 'balanced' },
  }),
  openaiCompat('nvidia', 'NVIDIA NIM', 'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'nemotron-mini-4b-instruct', 'https://integrate.api.nvidia.com/v1', 'NVIDIA_BASE_URL', 0, 24, {
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'byo-key', speed: 'fast' },
  }),

  /* ── EXPANDED CATALOG: active/experimental ── */
  openaiCompat('nous-portal', 'Nous Research', 'NOUS_API_KEY', 'NOUS_MODEL', 'hermes-3-llama-3.1-70b', 'https://api.nousresearch.com/v1', 'NOUS_BASE_URL', 0.0000008, 25, {
    status: 'experimental',
    tags: { speed: 'balanced' },
  }),
  openaiCompat('huggingface', 'Hugging Face', 'HF_API_KEY', 'HF_MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct', 'https://router.huggingface.co/v1', 'HF_BASE_URL', 0.000001, 26, {
    status: 'experimental',
    tags: { speed: 'balanced' },
    setupNote: 'Set HF_API_KEY to a Hugging Face User Access Token. Free tier available at huggingface.co.',
  }),
  openaiCompat('minimax', 'MiniMax', 'MINIMAX_API_KEY', 'MINIMAX_MODEL', 'MiniMax-Text-01', 'https://api.minimax.chat/v1', 'MINIMAX_BASE_URL', 0.0000012, 27, {
    status: 'experimental',
    tags: { speed: 'balanced' },
    setupNote: 'International MiniMax endpoint. Set MINIMAX_API_KEY from platform.minimaxi.com.',
  }),
  openaiCompat('minimax-cn', 'MiniMax (CN)', 'MINIMAX_CN_API_KEY', 'MINIMAX_CN_MODEL', 'MiniMax-Text-01', 'https://api.minimaxi.chat/v1', 'MINIMAX_CN_BASE_URL', 0.0000012, 28, {
    status: 'experimental',
    tags: { speed: 'balanced' },
    setupNote: 'China-region MiniMax endpoint. Set MINIMAX_CN_API_KEY.',
  }),
  openaiCompat('xiaomi-mimo', 'Xiaomi MiMo', 'XIAOMI_API_KEY', 'XIAOMI_MODEL', 'MiMo-7B-RL', 'https://api.mimo.xiaomi.com/v1', 'XIAOMI_BASE_URL', 0.0000005, 29, {
    status: 'experimental',
    tags: { speed: 'balanced' },
    setupNote: 'Xiaomi MiMo API. Set XIAOMI_API_KEY. Endpoint subject to change.',
  }),
  openaiCompat('llama-cpp', 'llama.cpp', 'LLAMACPP_API_KEY', 'LLAMACPP_MODEL', 'default', 'http://127.0.0.1:8080/v1', 'LLAMACPP_BASE_URL', 0, 30, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: false },
    tags: { cost: 'local', speed: 'fast' },
    setupNote: 'Start llama.cpp server: ./server -m model.gguf --port 8080. Set LLAMACPP_ENABLED=true.',
  }),
  openaiCompat('custom', 'Custom Endpoint', 'CUSTOM_API_KEY', 'CUSTOM_MODEL', 'default', '', 'CUSTOM_BASE_URL', 0, 31, {
    capabilities: { chat: true, vision: false, streaming: true, tools: false },
    tags: { cost: 'byo-key', speed: 'balanced' },
    setupNote: 'Any OpenAI-compatible endpoint. Set CUSTOM_BASE_URL and optionally CUSTOM_API_KEY.',
  }),
  openaiCompat('litellm', 'LiteLLM Proxy', 'LITELLM_API_KEY', 'LITELLM_MODEL', 'gpt-4o-mini', 'http://127.0.0.1:4000/v1', 'LITELLM_BASE_URL', 0, 32, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'local', speed: 'balanced' },
    setupNote: 'Run LiteLLM proxy locally. Set LITELLM_ENABLED=true and LITELLM_BASE_URL (default http://127.0.0.1:4000/v1).',
  }),
  openaiCompat('sglang', 'SGLang', 'SGLANG_API_KEY', 'SGLANG_MODEL', 'default', 'http://127.0.0.1:30000/v1', 'SGLANG_BASE_URL', 0, 33, {
    local: true,
    capabilities: { chat: true, vision: false, streaming: true, tools: true },
    tags: { cost: 'local', speed: 'balanced' },
    setupNote: 'Start SGLang OpenAI-compatible server. Set SGLANG_ENABLED=true.',
  }),
  openaiCompat('vertex', 'Google Vertex AI', 'VERTEX_API_KEY', 'VERTEX_MODEL', 'gemini-2.0-flash', '', 'VERTEX_BASE_URL', 0.00000035, 34, {
    status: 'experimental',
    capabilities: { chat: true, vision: true, streaming: true, tools: false, reasoning: true },
    tags: { speed: 'balanced', toolUse: false },
    setupNote: 'OpenAI-compatible Vertex proxy or gateway. Set VERTEX_BASE_URL and GCP credentials or proxy token.',
  }),
  openaiCompat('cloudflare-ai-gateway', 'Cloudflare AI Gateway', 'CLOUDFLARE_AI_API_KEY', 'CLOUDFLARE_AI_MODEL', 'gpt-4o-mini', '', 'CLOUDFLARE_AI_GATEWAY_URL', 0.000003, 35, {
    status: 'experimental',
    setupNote: 'Set CLOUDFLARE_AI_GATEWAY_URL to your gateway endpoint (https://gateway.ai.cloudflare.com/v1/...).',
  }),
  openaiCompat('byteplus', 'BytePlus ModelArk', 'BYTEPLUS_API_KEY', 'BYTEPLUS_MODEL', 'skylark-pro', 'https://ark.ap-southeast.bytepluses.com/api/v3', 'BYTEPLUS_BASE_URL', 0.0000008, 36, {
    status: 'experimental',
    tags: { speed: 'balanced' },
  }),
  openaiCompat('tencent', 'Tencent Hunyuan', 'TENCENT_API_KEY', 'TENCENT_MODEL', 'hunyuan-lite', 'https://api.hunyuan.cloud.tencent.com/v1', 'TENCENT_BASE_URL', 0.000001, 37, {
    status: 'experimental',
    tags: { speed: 'balanced' },
    setupNote: 'Also accepts HUNYUAN_API_KEY as alias via env fallback in isProviderConfigured.',
  }),
  openaiCompat('volcengine', 'Volcengine / Doubao', 'VOLCENGINE_API_KEY', 'VOLCENGINE_MODEL', 'doubao-pro-32k', 'https://ark.cn-beijing.volces.com/api/v3', 'VOLCENGINE_BASE_URL', 0.0000008, 38, {
    status: 'experimental',
    tags: { speed: 'balanced' },
  }),
  openaiCompat('bedrock-mantle', 'Amazon Bedrock Mantle', 'BEDROCK_MANTLE_API_KEY', 'BEDROCK_MANTLE_MODEL', 'amazon.titan-text-express-v1', '', 'BEDROCK_MANTLE_BASE_URL', 0.000003, 39, {
    status: 'experimental',
    setupNote: 'Bedrock Mantle OpenAI-compatible proxy. Set BEDROCK_MANTLE_BASE_URL and AWS credentials or proxy token.',
    tags: { cost: 'byo-key', speed: 'balanced' },
  }),

  /* ── EXTERNAL CLI PROVIDERS ── */
  externalCliEntry('openai-codex', 'OpenAI Codex', 'OPENAI_API_KEY',
    'Install: npm i -g @openai/codex. Uses OPENAI_API_KEY. Run as external agent from the shell.', 90),
  externalCliEntry('github-copilot', 'GitHub Copilot', 'GITHUB_TOKEN',
    'Auto-upgrades to API adapter when plugins/providers/github-copilot.ts loads. Run: gh auth token.', 91),
  externalCliEntry('github-copilot-acp', 'GitHub Copilot ACP', 'GITHUB_COPILOT_ACP_API_KEY',
    'GitHub Copilot ACP extension. Requires gh CLI, Copilot subscription, and ACP-enabled IDE.', 92),
  externalCliEntry('kilo-code', 'Kilo Code', 'KILO_CODE_API_KEY',
    'Install from kiloc.de. Set KILO_CODE_API_KEY. Invoked as a local coding agent.', 93),
  externalCliEntry('opencode-zen', 'OpenCode Zen', 'OPENCODE_API_KEY',
    'OpenCode Zen variant. Install from opencode.ai. Configured via its own config file.', 94),
  externalCliEntry('opencode-go', 'OpenCode Go', 'OPENCODE_API_KEY',
    'OpenCode Go variant. Install from opencode.ai. Same config as opencode-zen.', 95),

  /* ── OAUTH PROVIDERS ── */
  oauthEntry('qwen-oauth', 'Qwen (OAuth)', 'QWEN_OAUTH_API_KEY',
    'Qwen OAuth flow via DashScope console. Standard API key access: use the "qwen" provider instead.',
    'qwen', 96),

  /* ── ALIASES (catalog only - not routable) ── */
  aliasEntry('kimi', 'Kimi', 'moonshot', 97),
  aliasEntry('z-ai', 'Z.AI / GLM', 'zhipu', 98),
  aliasEntry('alibaba', 'Alibaba / DashScope', 'qwen', 99),

  /* ── EMBEDDINGS-ONLY (catalog; not routable for chat) ── */
  {
    name: 'voyage',
    displayName: 'Voyage AI',
    kind: 'openai',
    apiKeyEnv: 'VOYAGE_API_KEY',
    apiKeysPoolEnv: 'VOYAGE_API_KEYS',
    modelEnv: 'VOYAGE_MODEL',
    defaultModel: 'voyage-3',
    baseUrl: 'https://api.voyageai.com/v1',
    baseUrlEnv: 'VOYAGE_BASE_URL',
    capabilities: { chat: false, vision: false, streaming: false, tools: false },
    usdPerToken: 0.0000001,
    fallbackPriority: 100,
    status: 'unsupported',
    authType: 'api-key',
    setupNote: 'Embeddings-only provider. Use for RAG ingestion; not routed for chat turns.',
    tags: buildRoutingTags(
      { name: 'voyage', local: false, fallbackPriority: 100, capabilities: { chat: false, vision: false, streaming: false, tools: false }, usdPerToken: 0.0000001 },
      { cost: 'byo-key', speed: 'balanced', chat: false, code: false, vision: false, longContext: false, toolUse: false },
    ),
  },
];

export const PROVIDER_MAP = Object.fromEntries(
  PROVIDER_DEFINITIONS.map((d) => [d.name, d]),
) as Record<string, ProviderDefinition>;

export type ProviderName = (typeof PROVIDER_DEFINITIONS)[number]['name'];

export const KNOWN_LLM_PROVIDERS = PROVIDER_DEFINITIONS.map((d) => d.name) as ProviderName[];

export function isRoutableProvider(def: ProviderDefinition): boolean {
  return def.status === 'active' || def.status === 'experimental';
}

export const ROUTABLE_PROVIDERS = PROVIDER_DEFINITIONS.filter(isRoutableProvider);
export const ROUTABLE_PROVIDER_NAMES = ROUTABLE_PROVIDERS.map((d) => d.name);

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
  if (!isRoutableProvider(def)) return false;
  if (isProviderDisabled(def.name)) return false;
  if (def.local) {
    const envName = def.name.toUpperCase().replace(/-/g, '_');
    const flag = process.env[`${envName}_ENABLED`] === 'true'
      || process.env.CARINA_LOCAL_LLM_ENABLED === 'true';
    return flag && Boolean(providerBaseUrl(def));
  }
  if (def.name === 'azure' || def.name === 'bedrock' || def.name === 'bedrock-mantle' || def.name === 'vertex' || def.name === 'cloudflare-ai-gateway') {
    return Boolean(providerApiKey(def) && providerBaseUrl(def));
  }
  if (def.name === 'custom') {
    return Boolean(providerBaseUrl(def));
  }
  if (def.name === 'tencent') {
    const key = providerApiKey(def) || process.env.HUNYUAN_API_KEY || '';
    if (key) return true;
    const pool = process.env[def.apiKeysPoolEnv] ?? process.env.HUNYUAN_API_KEYS;
    return Boolean(pool && pool.trim());
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

export function buildProviderTagsMap(): Record<string, ProviderRoutingTags> {
  const out: Record<string, ProviderRoutingTags> = {};
  for (const def of PROVIDER_DEFINITIONS) {
    out[def.name] = def.tags;
  }
  return out;
}

export function providersWithTag(
  tag: keyof ProviderRoutingTags,
  value: string | boolean,
  configuredOnly = false,
): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.filter((def) => {
    if (configuredOnly && !isProviderConfigured(def)) return false;
    const v = def.tags[tag];
    return v === value;
  });
}

export function buildUsdPerTokenMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const def of PROVIDER_DEFINITIONS) {
    out[def.name] = def.usdPerToken;
  }
  return out;
}

export function fallbackOrderNames(): string[] {
  return ROUTABLE_PROVIDERS
    .slice()
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority)
    .map((d) => d.name);
}

export function resolveAliasTarget(name: string): string | undefined {
  const def = PROVIDER_MAP[name];
  if (def?.status === 'alias' && def.aliasFor) return def.aliasFor;
  return undefined;
}

/* ── PLUGIN REGISTRATION ── */

/**
 * Register providers from a plugin module.
 * Appends to PROVIDER_DEFINITIONS and refreshes derived maps.
 * Skips definitions whose names already exist (first registrant wins).
 * Returns the names that were actually added.
 */
export function registerPluginProviders(defs: ProviderDefinition[]): string[] {
  const existing = new Set(PROVIDER_DEFINITIONS.map((d) => d.name));
  const added: string[] = [];

  for (const def of defs) {
    if (existing.has(def.name)) {
      const current = PROVIDER_MAP[def.name];
      const canOverride = current
        && (current.status === 'external-cli' || current.status === 'unsupported')
        && (def.status === 'active' || def.status === 'experimental');
      if (canOverride) {
        const idx = PROVIDER_DEFINITIONS.findIndex((d) => d.name === def.name);
        if (idx >= 0) PROVIDER_DEFINITIONS[idx] = def;
        (PROVIDER_MAP as Record<string, ProviderDefinition>)[def.name] = def;
        added.push(def.name);
        continue;
      }
      console.warn(`[provider-registry] skipping duplicate plugin provider: ${def.name}`);
      continue;
    }
    existing.add(def.name);
    PROVIDER_DEFINITIONS.push(def);
    (PROVIDER_MAP as Record<string, ProviderDefinition>)[def.name] = def;
    added.push(def.name);
  }

  // Refresh derived arrays
  if (added.length > 0) {
    (KNOWN_LLM_PROVIDERS as ProviderName[]).splice(0, KNOWN_LLM_PROVIDERS.length, ...PROVIDER_DEFINITIONS.map((d) => d.name) as ProviderName[]);
    (ROUTABLE_PROVIDERS as ProviderDefinition[]).splice(0, ROUTABLE_PROVIDERS.length, ...PROVIDER_DEFINITIONS.filter(isRoutableProvider));
    (ROUTABLE_PROVIDER_NAMES as string[]).splice(0, ROUTABLE_PROVIDER_NAMES.length, ...ROUTABLE_PROVIDERS.map((d) => d.name));
  }

  return added;
}

/**
 * Disable a provider at runtime (prevents it from being used).
 * Does not remove from the catalog — just marks it suspended.
 */
const _disabledProviders = new Set<string>();

export function disableProvider(name: string): boolean {
  if (!PROVIDER_MAP[name]) return false;
  _disabledProviders.add(name);
  return true;
}

export function enableProvider(name: string): boolean {
  if (!PROVIDER_MAP[name]) return false;
  _disabledProviders.delete(name);
  return true;
}

export function isProviderDisabled(name: string): boolean {
  return _disabledProviders.has(name);
}

export function listDisabledProviders(): string[] {
  return [..._disabledProviders];
}
