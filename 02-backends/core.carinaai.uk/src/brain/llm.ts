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
  markProviderHealthy,
  markProviderUnhealthy,
} from './provider-health.js';
import {
  buildCopilotSelection,
  isFreeCopilotPreset,
  FREE_COPILOT_PRESET,
  resolveInitialActiveProvider,
} from './provider-routing.js';
import {
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  KNOWN_LLM_PROVIDERS,
  isProviderConfigured,
  providerApiKey,
  providerModel,
  type ProviderName,
} from './provider-registry.js';
import { isLlmRotationEnabled, resolveProviderFallbackChain } from './fallback-chain.js';
import {
  recordProviderFallback,
  recordProviderSuccess,
} from '../telemetry/provider-observation.js';
import { getProviderFactory } from '../plugins/loader.js';
import {
  classifyProviderError,
  getProviderPool,
  isProfilePoolEnabled,
} from '../providers/provider-pool.js';
import {
  anthropicCacheControlBlocks,
  getCachedSystemPrompt,
  recordProviderCacheHit,
} from './prompt-cache.js';
import type { Message, CarinaResponse, LLMProvider, Tool, ToolCall } from '../types/index.js';
import {
  applyThinkingExtrasToProviderRequest,
} from '../agents/thinking-levels.js';
import { getThinkingRequestExtras } from './thinking-request.js';
import { getMaxCompletionTokens } from './completion-tokens.js';
import { modelPolicyRouter } from '../model-router/model-policy-router.js';
import { recordModelPolicyDecision, recordModelUsageResult } from '../billing/ai-usage-ledger.js';
import { optimizeMessages } from '../token-efficiency/token-efficiency.js';
import { getCircuitBreaker } from '../lib/circuit-breaker.js';

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

You have access to tools for web search, file operations, email, HTTP requests, shell, and code execution. Use them proactively when they will help complete the task. For current web facts, always use web search.

Refusing sensitive requests: if asked to read, show, or reveal a .env file, credentials, API keys, or any system secret, say "No." and stop. Do not describe what those files contain or confirm that they exist. Silence is safer than a helpful refusal.

Answering capability questions: when asked what you can do, describe your abilities in plain sentences. Never list raw internal tool names or render a formatted tool inventory.`;

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

function isLateStreamCloseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /connection is closed|stream.*closed|terminated|econnreset/i.test(msg);
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
      let response: Anthropic.Message;
      try {
        const thinkingExtras = getThinkingRequestExtras() ?? {};
        response = await client.messages.create(
          applyThinkingExtrasToProviderRequest({
            model: model ?? providerModel(def),
            max_tokens: getMaxCompletionTokens(),
            system: anthropicCacheControlBlocks(prompt),
            messages: toAnthropicMessages(messages),
            ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
          }, thinkingExtras) as unknown as Anthropic.MessageCreateParams,
          { signal: llmRequestSignal() },
        ) as Anthropic.Message;
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
      const tokensIn = response.usage.input_tokens;
      const tokensOut = response.usage.output_tokens;
      const usageMeta = response.usage as { cache_read_input_tokens?: number };
      const tokensCached = usageMeta.cache_read_input_tokens ?? 0;
      return {
        content,
        toolsUsed: toolCalls.map((t) => t.toolName),
        tokensIn,
        tokensOut,
        tokensCached,
        tokensUsed: tokensIn + tokensOut,
        provider: 'anthropic' as const,
        toolCalls,
      };
    };

    const breaker = getCircuitBreaker(`llm:${def.name}`);
    if (this.fixedKey) return breaker.execute(() => run(this.client));

    return breaker.execute(() => withCredentialRotation(
      def.name,
      providerApiKey(def),
      process.env[def.apiKeysPoolEnv],
      async (apiKey) => run(new Anthropic({ apiKey })),
    ));
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const { prompt } = effectiveSystemPrompt(messages);
    const toolDefs = anthropicTools(tools);
    let stream;
    try {
      stream = this.client.messages.stream({
        model: model ?? providerModel(PROVIDER_MAP.anthropic),
        max_tokens: getMaxCompletionTokens(),
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

function geminiFunctionDeclarations(tools?: Tool[]): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  if (!tools?.length) return [];
  return tools.slice(0, 64).map((tool) => ({
    name: tool.name,
    description: tool.description || tool.name,
    parameters: (tool.parameters && typeof tool.parameters === 'object'
      ? tool.parameters
      : { type: 'object', properties: {} }) as Record<string, unknown>,
  }));
}

function toGeminiHistory(messages: Message[]): Array<{ role: string; parts: unknown[] }> {
  // Gemini multi-turn native functionResponse roles are version-fragile on some models
  // (400 "Role 'function' is not supported"). Flatten tool exchanges to text so
  // follow-up turns stay on user/model roles only. The current turn still uses
  // native functionDeclarations for the outbound call.
  const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'tool_result') {
      const name = m.toolName || 'tool';
      const payload = geminiFunctionResponsePayload(m.result ?? m.content);
      history.push({
        role: 'user',
        parts: [{
          text: `Tool ${name} returned:\n${JSON.stringify(payload).slice(0, 20_000)}`,
        }],
      });
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const calls = m.toolCalls
        .map((tc) => `${tc.toolName}(${JSON.stringify(tc.params ?? {})})`)
        .join(', ');
      const text = [m.content?.trim(), `[Called tools: ${calls}]`].filter(Boolean).join('\n');
      history.push({ role: 'model', parts: [{ text: text || `[Called tools: ${calls}]` }] });
      continue;
    }

    if (m.role === 'user' || m.role === 'assistant') {
      const text = m.content || '';
      if (!text && m.role === 'assistant') continue;
      history.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      });
    }
  }

  return history;
}

function geminiFunctionResponsePayload(value: unknown): Record<string, unknown> {
  try {
    const json = JSON.stringify(value ?? null, (_key, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'undefined') return null;
      return v;
    });
    const parsed = JSON.parse(json || 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: String(value ?? '') };
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

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const def = PROVIDER_MAP.gemini;
    const { prompt } = effectiveSystemPrompt(messages);
    const declarations = geminiFunctionDeclarations(tools);

    const run = async (client: GoogleGenerativeAI) => {
      // Bare strings 400 on system_instruction for some Gemini paths; use Content shape.
      const genModel = client.getGenerativeModel({
        model: model ?? providerModel(def),
        systemInstruction: { role: 'user', parts: [{ text: prompt }] },
        generationConfig: { maxOutputTokens: getMaxCompletionTokens() },
        ...(declarations.length > 0
          ? { tools: [{ functionDeclarations: declarations }] }
          : {}),
      } as Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]);

      // Exclude the trailing user turn from history; send it via sendMessage.
      const prior = messages.slice(0, -1);
      const last = messages.at(-1);
      const history = toGeminiHistory(prior);
      const chat = genModel.startChat({ history: history as never });

      let sendParts: string;
      if (last?.role === 'tool_result') {
        const name = last.toolName || 'tool';
        const payload = geminiFunctionResponsePayload(last.result ?? last.content);
        sendParts =
          `Tool ${name} returned:\n${JSON.stringify(payload).slice(0, 20_000)}\n`
          + 'Continue and answer the user based on this tool result.';
      } else if (last?.role === 'assistant' && last.toolCalls?.length) {
        sendParts = last.content || 'Continue.';
      } else {
        sendParts = last?.content ?? '';
      }

      const result = await chat.sendMessage(sendParts, { signal: llmRequestSignal() });
      const response = result.response;
      let content = '';
      try {
        content = response.text() ?? '';
      } catch {
        content = '';
      }

      const functionCalls = typeof response.functionCalls === 'function'
        ? response.functionCalls() ?? []
        : [];
      const toolCalls: ToolCall[] = functionCalls.map((fc, index) => ({
        type: 'tool_call' as const,
        toolName: String(fc.name ?? ''),
        toolCallId: `gemini-${Date.now()}-${index}`,
        params: (fc.args ?? {}) as Record<string, unknown>,
      })).filter((tc) => Boolean(tc.toolName));

      return {
        content,
        toolsUsed: toolCalls.map((t) => t.toolName),
        toolCalls,
        tokensIn: 0,
        tokensOut: 0,
        tokensCached: 0,
        tokensUsed: 0,
        provider: 'gemini' as const,
      };
    };

    const breaker = getCircuitBreaker(`llm:${def.name}`);
    if (this.fixedKey) return breaker.execute(() => run(this.client));

    return breaker.execute(() => withCredentialRotation(
      def.name,
      providerApiKey(def),
      process.env[def.apiKeysPoolEnv],
      async (apiKey) => run(new GoogleGenerativeAI(apiKey)),
    ));
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const response = await this.chat(messages, tools, model);
    if (response.content) yield response.content;
    for (const tc of response.toolCalls ?? []) yield tc;
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
    const configuredNames = [...this.providers.keys()];
    const resolved = resolveInitialActiveProvider({
      configuredNames,
      definitions: PROVIDER_DEFINITIONS,
      preferred,
      envPreset,
    });

    this.active = resolved.active ?? '';
    if (resolved.preset) this.preset = resolved.preset;

    if (!this.active) {
      console.error(
        'No LLM provider configured. Set DEFAULT_PROVIDER and an API key, or set GITHUB_TOKEN for GitHub Copilot.',
      );
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
    return resolveProviderFallbackChain({
      activeProvider: activeName,
      preset: this.preset,
      configuredNames: this.configuredNames(),
      definitions: PROVIDER_DEFINITIONS,
    });
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
    return this.routeChat(messages, tools, override, this.fallbackOrder(override));
  }

  private async chatViaProfilePool(
    messages: Message[],
    tools?: Tool[],
    override?: ProviderOverride,
  ): Promise<CarinaResponse> {
    const pool = getProviderPool();
    return pool.withFailover(async (profile) => {
      const creds = profile.apiKey || profile.baseUrl
        ? {
          provider: profile.provider,
          apiKey: profile.apiKey ?? '',
          baseUrl: profile.baseUrl,
          model: profile.model,
        }
        : undefined;
      const provider = createProvider(profile.provider, creds);
      if (!provider) {
        throw new Error(`Provider "${profile.provider}" is not configured for profile "${profile.name}"`);
      }
      const model = override?.model ?? profile.model;
      const result = await provider.chat(messages, tools, model);
      markProviderHealthy(profile.provider);
      recordProviderSuccess(profile.provider, model);
      return result;
    });
  }

  private async *streamViaProfilePool(
    messages: Message[],
    tools?: Tool[],
    override?: ProviderOverride,
  ): AsyncGenerator<string | ToolCall> {
    const pool = getProviderPool();
    let lastErr: unknown;
    for (const profile of pool.getAvailableProfiles()) {
      try {
        const creds = profile.apiKey || profile.baseUrl
          ? {
            provider: profile.provider,
            apiKey: profile.apiKey ?? '',
            baseUrl: profile.baseUrl,
            model: profile.model,
          }
          : undefined;
        const provider = createProvider(profile.provider, creds);
        if (!provider) {
          throw new Error(`Provider "${profile.provider}" is not configured for profile "${profile.name}"`);
        }
        const model = override?.model ?? profile.model;
        yield* provider.stream(messages, tools, model);
        pool.markSucceeded(profile.name);
        recordProviderSuccess(profile.provider, model);
        return;
      } catch (err) {
        lastErr = err;
        const providerError = classifyProviderError(err);
        if (providerError.type === 'invalid_request') throw err;
        pool.markFailed(profile.name, providerError);
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[llm] profile ${profile.name} stream failed (${msg}), trying next profile...`);
      }
    }
    throw lastErr ?? new Error('All provider profiles failed');
  }

  private shouldUseProfilePool(): boolean {
    // Profile-pool failover is a form of rotation; respect the lock switch.
    return isProfilePoolEnabled() && isLlmRotationEnabled();
  }

  private async routeChat(
    messages: Message[],
    tools?: Tool[],
    override?: ProviderOverride,
    orderedProviders?: Array<{ provider: LLMProvider; model?: string }>,
  ): Promise<CarinaResponse> {
    if (this.shouldUseProfilePool()) {
      return this.chatViaProfilePool(messages, tools, override);
    }
    return this.chatWithProviders(orderedProviders ?? this.fallbackOrder(override), messages, tools);
  }

  private async *routeStream(
    messages: Message[],
    tools?: Tool[],
    override?: ProviderOverride,
  ): AsyncGenerator<string | ToolCall> {
    if (this.shouldUseProfilePool()) {
      yield* this.streamViaProfilePool(messages, tools, override);
      return;
    }
    const providers = this.fallbackOrder(override);
    let lastErr: unknown;
    for (let i = 0; i < providers.length; i++) {
      const { provider, model } = providers[i]!;
      let yieldedOutput = false;
      try {
        for await (const chunk of provider.stream(messages, tools, model)) {
          yieldedOutput = true;
          yield chunk;
        }
        recordProviderSuccess(provider.name, model);
        return;
      } catch (err) {
        if (yieldedOutput && isLateStreamCloseError(err)) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[llm] ${provider.name} stream closed after output (${msg}); ending turn.`);
          recordProviderSuccess(provider.name, model);
          return;
        }
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const next = providers[i + 1]?.provider.name;
        if (next) {
          recordProviderFallback(provider.name, next, err);
          console.warn(`[llm] ${provider.name} stream failed (${msg}), trying next provider...`);
        }
      }
    }
    throw lastErr ?? new Error('All LLM providers failed.');
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

    const initialDecision = modelPolicyRouter.decide({
      messages,
      tools,
      taskType: classification === 'simple' ? 'simple_chat' : undefined,
      billingMode: effectiveTenantId ? 'subscription' : 'internal',
    });
    const tokenOptimization = optimizeMessages(messages, {
      tenantId: effectiveTenantId ?? '__local__',
      modelTier: initialDecision.tier,
      riskLevel: initialDecision.approvalRequired ? 'high' : 'low',
      allowSemanticCache: process.env.CARINA_SEMANTIC_RESPONSE_CACHE === 'true',
      allowPromptCompression: process.env.CARINA_PROMPT_COMPRESSION === 'true',
      allowProviderPromptCache: process.env.CARINA_PROMPT_CACHE === 'true',
      requestedOutputTokens: initialDecision.estimatedOutputTokens,
    });
    if (tokenOptimization.cacheHit) {
      await recordModelPolicyDecision({
        decision: initialDecision,
        tenantId: effectiveTenantId,
        surface: effectiveTenantId ? 'hosted' : 'local',
        feature: 'chat_routed_cache_hit',
        billingMode: effectiveTenantId ? 'subscription' : 'internal',
        tokenOptimization,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[llm] model policy decision ledger write failed (${msg})`);
      });
      return {
        content: tokenOptimization.cacheHit.response,
        toolsUsed: [],
        tokensIn: 0,
        tokensOut: 0,
        tokensCached: tokenOptimization.rawEstimatedInputTokens,
        tokensUsed: 0,
        provider: `${tokenOptimization.cacheHit.kind}_cache`,
      };
    }

    const decision = modelPolicyRouter.decide({
      messages: tokenOptimization.messages,
      tools,
      taskType: classification === 'simple' ? 'simple_chat' : undefined,
      billingMode: effectiveTenantId ? 'subscription' : 'internal',
    });
    await recordModelPolicyDecision({
      decision,
      tenantId: effectiveTenantId,
      surface: effectiveTenantId ? 'hosted' : 'local',
      feature: 'chat_routed',
      billingMode: effectiveTenantId ? 'subscription' : 'internal',
      tokenOptimization,
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] model policy decision ledger write failed (${msg})`);
    });
    if (!decision.allowed) {
      throw new Error(decision.downgradeMessage ?? decision.reason);
    }

    const selectedProvider = this.providers.has(decision.selectedProvider)
      ? decision.selectedProvider
      : classification === 'simple'
        ? this.cheap().name
        : this.current().name;
    const selectedModel = this.providers.has(decision.selectedProvider)
      ? decision.selectedModel
      : undefined;
    const startProvider = selectedProvider;
    const tenantCreds = await resolveTenantCredentials(effectiveTenantId, startProvider);
    if (tenantCreds) {
      const tenantProvider = createProvider(startProvider, tenantCreds);
      if (tenantProvider) {
        try {
          const startedAt = Date.now();
          const result = await tenantProvider.chat(tokenOptimization.messages, tools, tenantCreds.model ?? selectedModel);
          await recordModelUsageResult({
            decision,
            response: result,
            tenantId: effectiveTenantId,
            surface: 'hosted',
            feature: 'chat_routed',
            billingMode: 'byok',
            byok: true,
            latencyMs: Date.now() - startedAt,
            tokenOptimization,
          }).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[llm] model usage ledger write failed (${msg})`);
          });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[llm] tenant ${startProvider} failed (${msg}), falling back to global...`);
        }
      }
    }

    const startedAt = Date.now();
    const result = await this.routeChat(
      tokenOptimization.messages,
      tools,
      { name: startProvider, model: selectedModel },
      this.fallbackOrder({ name: startProvider, model: selectedModel }),
    );
    await recordModelUsageResult({
      decision,
      response: result,
      tenantId: effectiveTenantId,
      surface: effectiveTenantId ? 'hosted' : 'local',
      feature: 'chat_routed',
      billingMode: effectiveTenantId ? 'subscription' : 'internal',
      byok: false,
      latencyMs: Date.now() - startedAt,
      tokenOptimization,
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] model usage ledger write failed (${msg})`);
    });
    return result;
  }

  private async chatWithProviders(
    providers: Array<{ provider: LLMProvider; model?: string }>,
    messages: Message[],
    tools?: Tool[],
  ): Promise<CarinaResponse> {
    let lastErr: unknown;
    for (let i = 0; i < providers.length; i++) {
      const { provider, model } = providers[i]!;
      try {
        const result = await provider.chat(messages, tools, model);
        markProviderHealthy(provider.name);
        recordProviderSuccess(provider.name, model);
        return result;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        markProviderUnhealthy(provider.name, msg);
        const next = providers[i + 1]?.provider.name;
        if (next) {
          recordProviderFallback(provider.name, next, err);
          console.warn(`[llm] ${provider.name} failed (${msg}), trying next provider...`);
        }
      }
    }
    throw lastErr ?? new Error('All LLM providers failed.');
  }

  async *stream(messages: Message[], tools?: Tool[], override?: ProviderOverride): AsyncGenerator<string | ToolCall> {
    yield* this.routeStream(messages, tools, override);
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  cheap(): LLMProvider {
    const order = resolveProviderFallbackChain({
      activeProvider: this.active,
      preset: this.preset,
      configuredNames: this.configuredNames(),
      definitions: PROVIDER_DEFINITIONS,
    });
    for (const name of order) {
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
