import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { withCredentialRotation } from '../credentials/credential-retry.js';
import { resolveApiKey } from './credential-pool.js';
import {
  anthropicTools,
  openaiTools,
  toAnthropicMessages,
  toOpenAIMessages,
} from './messages.js';
import { classifyComplexity, type TaskComplexity } from './task-classifier.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';
import { isAbortLikeError, llmRequestSignal, llmRequestTimeoutMs } from './request-timeout.js';
import { getTenantProvider } from './tenant-provider-keys.js';
import type { TenantProviderOverride } from './tenant-provider-keys.js';
import {
  isProviderAvailable,
  markProviderHealthy,
  markProviderUnhealthy,
} from './provider-health.js';
import {
  buildCopilotSelection,
  freeCopilotProviderOrder,
  isFreeCopilotPreset,
  mergeFallbackOrder,
  FREE_COPILOT_PRESET,
} from './provider-routing.js';
import {
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  KNOWN_LLM_PROVIDERS,
  fallbackOrderNames,
  isProviderConfigured,
  providerApiKey,
  providerModel,
  type ProviderName,
} from './provider-registry.js';
import { getProviderFactory } from '../plugins/loader.js';
import {
  anthropicCacheControlBlocks,
  getCachedSystemPrompt,
  recordProviderCacheHit,
} from './prompt-cache.js';
import type { Message, CarinaResponse, LLMProvider, Tool, ToolCall } from '../types/index.js';

export type { ProviderName };
export { KNOWN_LLM_PROVIDERS, FREE_COPILOT_PRESET };

export interface ProviderOverride {
  name: string;
  model?: string;
}

export const SYSTEM_PROMPT = `You are Carina, an autonomous AI agent built by VERLOX Ltd.

You are not a chatbot. You are an agent. You take actions, execute tasks, remember context, and improve over time.

Your principles:
- Complete tasks fully. Do not narrate the process unless the user asks.
- Use tools when they are needed
- Be direct, concise, and plain-spoken
- Keep answers short by default. Expand only when necessary
- If you cannot complete a task, say exactly why and what is needed
- You remember past conversations and build on them
- Avoid generic assistant phrasing such as "of course", "certainly", "how can I help", or "as an AI"
- Avoid chatty framing. Answer like a tool, not a support agent.
- Never use emojis, emoticons, or Unicode symbols in any response. Use plain text only.
- Never use em dashes. Use commas, colons, or full stops instead.
- Only answer what is asked. Do not volunteer unrequested analysis.

You have access to tools for: web-search (Tavily live search), file operations, email, HTTP requests, shell, and code execution.
Use them proactively when they will help complete the task. For current web facts, always use web-search, not search-files.`;

function parseToolCallsFromOpenAI(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined,
): ToolCall[] {
  if (!toolCalls?.length) return [];
  return toolCalls
    .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => tc.type === 'function')
    .map((tc) => ({
      type: 'tool_call' as const,
      toolName: tc.function.name,
      toolCallId: tc.id,
      params: JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>,
    }));
}

function effectiveSystemPrompt(messages: Message[]): { prompt: string; cacheKey: string } {
  const cached = getCachedSystemPrompt(messages);
  const dynamic = cached.systemPrompt.trim();
  const combined = dynamic ? `${SYSTEM_PROMPT}\n\n---\n\n${dynamic}` : SYSTEM_PROMPT;
  return { prompt: combined, cacheKey: cached.cacheKey };
}

export class ClaudeProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;
  private readonly fixedKey?: string;

  constructor(apiKeyOverride?: string) {
    const def = PROVIDER_MAP.anthropic;
    this.fixedKey = apiKeyOverride;
    const apiKey = apiKeyOverride
      ?? resolveApiKey(providerApiKey(def), process.env[def.apiKeysPoolEnv], def.name);
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const def = PROVIDER_MAP.anthropic;
    const { prompt, cacheKey } = effectiveSystemPrompt(messages);
    const toolDefs = anthropicTools(tools);

    const run = async (client: Anthropic) => {
      let response;
      try {
        response = await client.messages.create({
          model: model ?? providerModel(def),
          max_tokens: 8192,
          system: anthropicCacheControlBlocks(prompt),
          messages: toAnthropicMessages(messages),
          ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
        }, { signal: llmRequestSignal() });
      } catch (err) {
        if (isAbortLikeError(err)) {
          throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
        }
        throw err;
      }
      recordProviderCacheHit(this.name, cacheKey);
      const content = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('');
      const toolCalls = response.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => (b.type === 'tool_use'
          ? {
              type: 'tool_call' as const,
              toolName: b.name,
              toolCallId: b.id,
              params: b.input as Record<string, unknown>,
            }
          : undefined))
        .filter((call): call is ToolCall => call !== undefined);
      return {
        content,
        toolsUsed: toolCalls.map((t) => t.toolName),
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        provider: 'anthropic' as const,
        toolCalls,
      };
    };

    if (this.fixedKey) return run(this.client);

    return withCredentialRotation(
      def.name,
      providerApiKey(def),
      process.env[def.apiKeysPoolEnv],
      async (apiKey) => run(new Anthropic({ apiKey })),
    );
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const { prompt } = effectiveSystemPrompt(messages);
    const toolDefs = anthropicTools(tools);
    let stream;
    try {
      stream = this.client.messages.stream({
        model: model ?? providerModel(PROVIDER_MAP.anthropic),
        max_tokens: 8192,
        system: anthropicCacheControlBlocks(prompt),
        messages: toAnthropicMessages(messages),
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      }, { signal: llmRequestSignal() });
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }

    try {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }

    const final = await stream.finalMessage();
    for (const block of final.content) {
      if (block.type === 'tool_use') {
        yield {
          type: 'tool_call',
          toolName: block.name,
          toolCallId: block.id,
          params: block.input as Record<string, unknown>,
        };
      }
    }
  }
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI;
  private readonly fixedKey?: string;

  constructor(apiKeyOverride?: string) {
    const def = PROVIDER_MAP.gemini;
    this.fixedKey = apiKeyOverride;
    const apiKey = apiKeyOverride
      ?? resolveApiKey(providerApiKey(def), process.env[def.apiKeysPoolEnv], def.name);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: Message[], _tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const def = PROVIDER_MAP.gemini;
    const { prompt } = effectiveSystemPrompt(messages);

    const run = async (client: GoogleGenerativeAI) => {
      const genModel = client.getGenerativeModel({ model: model ?? providerModel(def) });
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const last = messages.at(-1)?.content ?? '';
      const chat = genModel.startChat({
        history,
        systemInstruction: prompt,
      });
      const result = await chat.sendMessage(last, { signal: llmRequestSignal() });
      return {
        content: result.response.text(),
        toolsUsed: [],
        tokensUsed: 0,
        provider: 'gemini' as const,
      };
    };

    if (this.fixedKey) return run(this.client);

    return withCredentialRotation(
      def.name,
      providerApiKey(def),
      process.env[def.apiKeysPoolEnv],
      async (apiKey) => run(new GoogleGenerativeAI(apiKey)),
    );
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const response = await this.chat(messages, tools, model);
    yield response.content;
  }
}

function createProvider(defName: string, tenantCreds?: TenantProviderOverride): LLMProvider | null {
  const def = PROVIDER_MAP[defName];
  if (!def) return null;
  if (!tenantCreds?.apiKey && !isProviderConfigured(def)) return null;

  // Plugin factory takes priority for non-standard adapters
  const factory = getProviderFactory(defName);
  if (factory) {
    const provider = factory(def);
    if (provider) return provider;
  }

  if (def.kind === 'anthropic') return new ClaudeProvider(tenantCreds?.apiKey);
  if (def.kind === 'gemini') return new GeminiProvider(tenantCreds?.apiKey);
  return new OpenAICompatibleProvider(def, SYSTEM_PROMPT, tenantCreds
    ? { apiKey: tenantCreds.apiKey, baseUrl: tenantCreds.baseUrl, model: tenantCreds.model }
    : undefined);
}

const tenantCredCache = new Map<string, { value: TenantProviderOverride | null; expiry: number }>();
const TENANT_CRED_TTL_MS = 60_000;

async function resolveTenantCredentials(
  tenantId: string | undefined,
  providerName: string,
): Promise<TenantProviderOverride | null> {
  if (!tenantId) return null;
  const cacheKey = `${tenantId}:${providerName}`;
  const cached = tenantCredCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.value;
  const value = await getTenantProvider(tenantId, providerName);
  tenantCredCache.set(cacheKey, { value, expiry: Date.now() + TENANT_CRED_TTL_MS });
  return value;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private active: string;
  private activeModels: Map<string, string> = new Map();
  private tenantId?: string;
  private preset?: string;

  setTenant(tenantId: string | undefined): void {
    this.tenantId = tenantId;
  }

  constructor() {
    for (const def of PROVIDER_DEFINITIONS) {
      const provider = createProvider(def.name);
      if (provider) this.providers.set(def.name, provider);
    }

    const envPreset = process.env.CARINA_LLM_PRESET;
    const preferred = process.env.DEFAULT_PROVIDER ?? config.carina.defaultProvider;

    if (isFreeCopilotPreset(envPreset) || isFreeCopilotPreset(preferred)) {
      this.preset = FREE_COPILOT_PRESET;
      const selection = buildCopilotSelection([...this.providers.keys()], PROVIDER_DEFINITIONS);
      this.active = selection.primary
        ?? this.providers.keys().next().value
        ?? 'deepseek';
    } else {
      this.active = this.providers.has(preferred) ? preferred : (this.providers.keys().next().value ?? 'deepseek');
    }
  }

  refreshPlugins(): void {
    for (const def of PROVIDER_DEFINITIONS) {
      if (!this.providers.has(def.name)) {
        const provider = createProvider(def.name);
        if (provider) this.providers.set(def.name, provider);
      }
    }
  }

  getPreset(): string | undefined {
    return this.preset;
  }

  setPreset(preset: string | undefined): void {
    if (preset && !isFreeCopilotPreset(preset)) {
      throw new Error(`Unknown LLM preset: ${preset}`);
    }
    this.preset = preset;
    if (isFreeCopilotPreset(preset)) {
      const selection = buildCopilotSelection([...this.providers.keys()], PROVIDER_DEFINITIONS);
      if (selection.primary) this.active = selection.primary;
    }
  }

  copilotSelection() {
    return buildCopilotSelection([...this.providers.keys()], PROVIDER_DEFINITIONS);
  }

  private configuredNames(): string[] {
    return [...this.providers.keys()];
  }

  private orderedProviderNames(activeName: string): string[] {
    const base = isFreeCopilotPreset(this.preset)
      ? freeCopilotProviderOrder(this.configuredNames(), PROVIDER_DEFINITIONS)
      : fallbackOrderNames();
    return mergeFallbackOrder(activeName, base).filter((name) => isProviderAvailable(name));
  }

  use(provider: string, model?: string): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider "${provider}" is not configured. Add its API key to .env`);
    }
    this.active = provider;
    if (model) this.activeModels.set(provider, model);
    console.log(`Switched to provider: ${provider}`);
  }

  current(): LLMProvider {
    const provider = this.providers.get(this.active);
    if (!provider) throw new Error('No provider available. Check your .env API keys.');
    return provider;
  }

  currentModel(): string {
    return this.modelFor(this.active);
  }

  modelFor(provider: string): string {
    const def = PROVIDER_MAP[provider];
    return this.activeModels.get(provider) ?? (def ? providerModel(def) : '');
  }

  isKnownProvider(provider: string): boolean {
    return KNOWN_LLM_PROVIDERS.includes(provider as ProviderName);
  }

  isProviderConfigured(provider: string): boolean {
    return this.providers.has(provider);
  }

  listKnown(): string[] {
    return [...KNOWN_LLM_PROVIDERS];
  }

  private fallbackOrder(override?: ProviderOverride): Array<{ provider: LLMProvider; model?: string }> {
    const activeName = override?.name ?? this.active;
    const names = this.orderedProviderNames(activeName);
    const out: Array<{ provider: LLMProvider; model?: string }> = [];
    for (const name of names) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      out.push({
        provider,
        model: name === activeName
          ? (override?.model ?? this.activeModels.get(name))
          : this.activeModels.get(name),
      });
    }
    return out;
  }

  async chat(
    messages: Message[],
    tools?: Tool[],
    override?: ProviderOverride,
    tenantId?: string,
  ): Promise<CarinaResponse> {
    const effectiveTenantId = tenantId ?? this.tenantId;
    const providerName = override?.name ?? this.active;
    const tenantCreds = await resolveTenantCredentials(effectiveTenantId, providerName);
    if (tenantCreds) {
      const tenantProvider = createProvider(providerName, tenantCreds);
      if (tenantProvider) {
        try {
          return await tenantProvider.chat(
            messages,
            tools,
            tenantCreds.model ?? override?.model,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[llm] tenant ${providerName} failed (${msg}), falling back to global...`);
        }
      }
    }
    return this.chatWithProviders(this.fallbackOrder(override), messages, tools);
  }

  async chatRouted(
    messages: Message[],
    tools?: Tool[],
    classification: TaskComplexity = classifyComplexity(messages),
    override?: ProviderOverride,
    tenantId?: string,
  ): Promise<CarinaResponse> {
    const effectiveTenantId = tenantId ?? this.tenantId;
    if (override) return this.chat(messages, tools, override, effectiveTenantId);

    const startProvider = classification === 'simple' ? this.cheap().name : this.current().name;
    const tenantCreds = await resolveTenantCredentials(effectiveTenantId, startProvider);
    if (tenantCreds) {
      const tenantProvider = createProvider(startProvider, tenantCreds);
      if (tenantProvider) {
        try {
          return await tenantProvider.chat(messages, tools, tenantCreds.model);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[llm] tenant ${startProvider} failed (${msg}), falling back to global...`);
        }
      }
    }

    return this.chatWithProviders(this.fallbackOrder({ name: startProvider }), messages, tools);
  }

  private async chatWithProviders(
    providers: Array<{ provider: LLMProvider; model?: string }>,
    messages: Message[],
    tools?: Tool[],
  ): Promise<CarinaResponse> {
    let lastErr: unknown;
    for (const { provider, model } of providers) {
      try {
        const result = await provider.chat(messages, tools, model);
        markProviderHealthy(provider.name);
        return result;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        markProviderUnhealthy(provider.name, msg);
        if (provider.name !== providers.at(-1)?.provider.name) {
          console.warn(`[llm] ${provider.name} failed (${msg}), trying next provider...`);
        }
      }
    }
    throw lastErr ?? new Error('All LLM providers failed.');
  }

  async *stream(messages: Message[], tools?: Tool[], override?: ProviderOverride): AsyncGenerator<string | ToolCall> {
    const providers = this.fallbackOrder(override);
    let lastErr: unknown;
    for (const { provider, model } of providers) {
      try {
        yield* provider.stream(messages, tools, model);
        return;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (provider.name !== providers.at(-1)?.provider.name) {
          console.warn(`[llm] ${provider.name} stream failed (${msg}), trying next provider...`);
        }
      }
    }
    throw lastErr ?? new Error('All LLM providers failed.');
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  cheap(): LLMProvider {
    const order = isFreeCopilotPreset(this.preset)
      ? freeCopilotProviderOrder(this.configuredNames(), PROVIDER_DEFINITIONS)
      : fallbackOrderNames();
    for (const name of order) {
      if (!isProviderAvailable(name)) continue;
      const p = this.providers.get(name);
      if (p) return p;
    }
    return this.current();
  }

  async chatCheap(messages: Message[], tools?: Tool[]): Promise<CarinaResponse> {
    return this.cheap().chat(messages, tools);
  }
}

export const llm = new LLMRouter();
