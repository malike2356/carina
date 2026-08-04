import OpenAI from 'openai';
import { withCredentialRotation } from '../credentials/credential-retry.js';
import { resolveApiKey } from './credential-pool.js';
import { isAbortLikeError, llmRequestSignal, llmRequestTimeoutMs } from './request-timeout.js';
import { openaiTools, toOpenAIMessages } from './messages.js';
import {
  getCachedSystemPrompt,
  openaiPromptCacheKey,
  recordProviderCacheHit,
} from './prompt-cache.js';
import { recordProviderRateLimitHeaders } from './provider-quota-poller.js';
import type { ProviderDefinition } from './provider-registry.js';
import { providerApiKey, providerBaseUrl, providerModel } from './provider-registry.js';
import type { CarinaResponse, LLMProvider, Message, Tool, ToolCall } from '../types/index.js';
import {
  applyThinkingExtrasToProviderRequest,
  mapThinkingLevelToProvider,
} from '../agents/thinking-levels.js';
import { getThinkingRequestExtras } from './thinking-request.js';
import { maybeDebugProxyBaseUrl } from './provider-proxy-routing.js';
import { getCircuitBreaker } from '../lib/circuit-breaker.js';

function parseToolCalls(
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

/**
 * Some models (e.g. deepseek-v4-flash / reasoners) put the visible answer in
 * `reasoning_content` and leave `content` empty. Prefer content; fall back to
 * reasoning text so chats do not hang on empty replies.
 */
export function extractAssistantText(msg: {
  content?: string | null;
  reasoning_content?: string | null;
} | null | undefined): string {
  const content = typeof msg?.content === 'string' ? msg.content.trim() : '';
  if (content) return content;
  const reasoning = typeof msg?.reasoning_content === 'string' ? msg.reasoning_content.trim() : '';
  return reasoning;
}

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private client: OpenAI;
  private readonly defaultModel: string;
  private readonly fixedApiKey?: string;
  private readonly fixedBaseUrl?: string;

  constructor(
    private readonly def: ProviderDefinition,
    baseSystemPrompt: string,
    credentials?: ProviderCredentials,
  ) {
    this.name = def.name;
    this.defaultModel = credentials?.model ?? providerModel(def);
    this.fixedApiKey = credentials?.apiKey;
    this.fixedBaseUrl = credentials?.baseUrl;
    const resolvedKey = credentials?.apiKey
      ?? resolveApiKey(providerApiKey(def), process.env[def.apiKeysPoolEnv], def.name);
    // Local providers (ollama, etc.) often have no real API key. Empty string is not
    // nullish, so prefer `||` so we still pass a placeholder OpenAI will accept.
    // Never pass "" into OpenAI(): SDK 6+ throws Missing credentials at construct time.
    const apiKey = resolvedKey || (def.local ? 'local' : 'missing-key-placeholder');
    const baseURL = credentials?.baseUrl ?? (providerBaseUrl(def) || undefined);
    this.client = this.buildClient(apiKey, baseURL);
    void baseSystemPrompt;
  }

  private buildClient(apiKey: string, baseUrl?: string): OpenAI {
    const routed = maybeDebugProxyBaseUrl(this.def.name, baseUrl);
    return new OpenAI({
      apiKey: apiKey || (this.def.local ? 'local' : apiKey),
      baseURL: routed || undefined,
    });
  }

  private resolveApiKeyForCall(): string {
    if (this.fixedApiKey) return this.fixedApiKey;
    const resolved = resolveApiKey(
      providerApiKey(this.def),
      process.env[this.def.apiKeysPoolEnv],
      this.def.name,
    );
    return resolved || (this.def.local ? 'local' : '');
  }

  private resolveSystem(messages: Message[], override?: string): { prompt: string; cacheKey: string } {
    const extracted = getCachedSystemPrompt(messages);
    return {
      prompt: override ?? extracted.systemPrompt,
      cacheKey: extracted.cacheKey,
    };
  }

  async chat(messages: Message[], tools?: Tool[], model?: string, systemOverride?: string): Promise<CarinaResponse> {
    const { prompt, cacheKey } = this.resolveSystem(messages, systemOverride);
    const toolDefs = openaiTools(tools);
    const cacheKeyHeader = openaiPromptCacheKey(prompt);

    const run = async (client: OpenAI) => {
      let response;
      try {
        const result = await client.chat.completions.create(
          applyThinkingExtrasToProviderRequest({
            model: model ?? this.defaultModel,
            max_tokens: 8192,
            messages: toOpenAIMessages(messages, prompt),
            ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
            ...(cacheKeyHeader
              ? { user: `carina-cache-${cacheKeyHeader}` }
              : {}),
          }, getThinkingRequestExtras() ?? {}) as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
          { signal: llmRequestSignal() },
        ).withResponse();
        recordProviderRateLimitHeaders(this.name, Object.fromEntries(result.response.headers));
        response = result.data;
      } catch (err) {
        if (isAbortLikeError(err)) {
          throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
        }
        throw err;
      }
      recordProviderCacheHit(this.name, cacheKey);
      const msg = response.choices[0]?.message as
        | { content?: string | null; reasoning_content?: string | null; tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] }
        | undefined;
      const toolCalls = parseToolCalls(msg?.tool_calls);
      const usage = response.usage;
      const tokensIn = usage?.prompt_tokens ?? 0;
      const tokensOut = usage?.completion_tokens ?? 0;
      return {
        content: extractAssistantText(msg),
        toolsUsed: toolCalls.map((t) => t.toolName),
        tokensIn,
        tokensOut,
        tokensCached: 0,
        tokensUsed: tokensIn + tokensOut,
        provider: this.name,
        toolCalls,
      };
    };

    const breaker = getCircuitBreaker(`llm:${this.def.name}`);

    if (this.fixedApiKey) {
      return breaker.execute(() => run(this.client));
    }

    return breaker.execute(() => withCredentialRotation(
      this.def.name,
      providerApiKey(this.def),
      process.env[this.def.apiKeysPoolEnv],
      async (apiKey) => {
        const client = this.buildClient(apiKey, this.fixedBaseUrl ?? (providerBaseUrl(this.def) || undefined));
        return run(client);
      },
    ));
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string, systemOverride?: string): AsyncGenerator<string | ToolCall> {
    const apiKey = this.resolveApiKeyForCall();
    const client = this.fixedApiKey
      ? this.client
      : this.buildClient(apiKey, this.fixedBaseUrl ?? (providerBaseUrl(this.def) || undefined));
    const { prompt } = this.resolveSystem(messages, systemOverride);
    const toolDefs = openaiTools(tools);
    let stream;
    try {
      const result = await client.chat.completions.create({
        model: model ?? this.defaultModel,
        max_tokens: 8192,
        stream: true,
        messages: toOpenAIMessages(messages, prompt),
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      }, { signal: llmRequestSignal() }).withResponse();
      recordProviderRateLimitHeaders(this.name, Object.fromEntries(result.response.headers));
      stream = result.data;
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }

    const acc = new Map<number, { id: string; name: string; args: string }>();
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as
          | { content?: string; reasoning_content?: string; tool_calls?: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[] }
          | undefined;
        if (delta?.content) yield delta.content;
        else if (delta?.reasoning_content) yield delta.reasoning_content;
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            let entry = acc.get(idx);
            if (!entry) {
              entry = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
              acc.set(idx, entry);
            }
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
          }
        }
      }
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }
    for (const entry of acc.values()) {
      yield {
        type: 'tool_call',
        toolName: entry.name,
        toolCallId: entry.id,
        params: JSON.parse(entry.args || '{}') as Record<string, unknown>,
      };
    }
  }
}
