import OpenAI from 'openai';
import { withCredentialRotation } from '../credentials/credential-retry.js';
import { resolveApiKey } from './credential-pool.js';
import { isAbortLikeError, llmRequestSignal, llmRequestTimeoutMs } from './request-timeout.js';
import { openaiTools, toOpenAIMessages } from './messages.js';
import { getCachedSystemPrompt, openaiPromptCacheKey, recordProviderCacheHit } from './prompt-cache.js';
import type { ProviderDefinition } from './provider-registry.js';
import { providerApiKey, providerBaseUrl, providerModel } from './provider-registry.js';
import type { CarinaResponse, LLMProvider, Message, Tool, ToolCall } from '../types/index.js';
import { maybeDebugProxyBaseUrl } from './provider-proxy-routing.js';

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
    const apiKey = credentials?.apiKey
      ?? resolveApiKey(providerApiKey(def), process.env[def.apiKeysPoolEnv], def.name)
      ?? (def.local ? 'local' : '');
    const baseURL = credentials?.baseUrl ?? (providerBaseUrl(def) || undefined);
    this.client = this.buildClient(apiKey, baseURL);
    void baseSystemPrompt;
  }

  private buildClient(apiKey: string, baseUrl?: string): OpenAI {
    const routed = maybeDebugProxyBaseUrl(this.def.name, baseUrl);
    return new OpenAI({
      apiKey,
      baseURL: routed || undefined,
    });
  }

  private resolveApiKeyForCall(): string {
    if (this.fixedApiKey) return this.fixedApiKey;
    return resolveApiKey(
      providerApiKey(this.def),
      process.env[this.def.apiKeysPoolEnv],
      this.def.name,
    ) || (this.def.local ? 'local' : '');
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
        response = await client.chat.completions.create({
          model: model ?? this.defaultModel,
          max_tokens: 8192,
          messages: toOpenAIMessages(messages, prompt),
          ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
          ...(cacheKeyHeader
            ? { user: `carina-cache-${cacheKeyHeader}` }
            : {}),
        }, { signal: llmRequestSignal() });
      } catch (err) {
        if (isAbortLikeError(err)) {
          throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
        }
        throw err;
      }
      recordProviderCacheHit(this.name, cacheKey);
      const msg = response.choices[0]?.message;
      const toolCalls = parseToolCalls(msg?.tool_calls);
      const usage = response.usage;
      return {
        content: msg?.content ?? '',
        toolsUsed: toolCalls.map((t) => t.toolName),
        tokensUsed: (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
        provider: this.name,
        toolCalls,
      };
    };

    if (this.fixedApiKey) {
      return run(this.client);
    }

    return withCredentialRotation(
      this.def.name,
      providerApiKey(this.def),
      process.env[this.def.apiKeysPoolEnv],
      async (apiKey) => {
        const client = this.buildClient(apiKey, this.fixedBaseUrl ?? (providerBaseUrl(this.def) || undefined));
        return run(client);
      },
    );
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
      stream = await client.chat.completions.create({
        model: model ?? this.defaultModel,
        max_tokens: 8192,
        stream: true,
        messages: toOpenAIMessages(messages, prompt),
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      }, { signal: llmRequestSignal() });
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`LLM request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }

    const acc = new Map<number, { id: string; name: string; args: string }>();
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) yield delta.content;
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
