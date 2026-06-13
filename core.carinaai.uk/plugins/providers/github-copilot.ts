/**
 * GitHub Copilot provider plugin.
 *
 * Uses GitHub Copilot's free tier API (requires a GitHub account with Copilot
 * access).  Auth via `GITHUB_TOKEN` env var (run `gh auth token` to get one).
 *
 * The Copilot API is close to OpenAI-compatible but requires:
 *  - Bearer auth with a GitHub token
 *  - `editor-version` header
 *  - `Copilot-Integration-Id` header
 *
 * Register this file under plugins/providers/ and it auto-loads at startup.
 */

import OpenAI from 'openai';
import { withCredentialRotation } from '../../src/credentials/credential-retry.js';
import { resolveApiKey } from '../../src/brain/credential-pool.js';
import { isAbortLikeError, llmRequestSignal, llmRequestTimeoutMs } from '../../src/brain/request-timeout.js';
import {
  openaiTools,
  toOpenAIMessages,
} from '../../src/brain/messages.js';
import {
  getCachedSystemPrompt,
  openaiPromptCacheKey,
  recordProviderCacheHit,
} from '../../src/brain/prompt-cache.js';
import type { ProviderDefinition } from '../../src/brain/provider-registry.js';
import {
  providerApiKey,
  providerBaseUrl,
  providerModel,
} from '../../src/brain/provider-registry.js';
import { buildRoutingTags } from '../../src/brain/provider-tags.js';
import type { CarinaResponse, LLMProvider, Message, Tool, ToolCall } from '../../src/types/index.js';
import type { ProviderPlugin } from '../../src/plugins/types.js';

/* ── Copilot-specific adapter ── */

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

class CopilotProvider implements LLMProvider {
  readonly name = 'github-copilot';
  private readonly defaultModel: string;
  private readonly fixedApiKey?: string;

  constructor(private readonly def: ProviderDefinition) {
    this.defaultModel = providerModel(def);
    this.fixedApiKey = resolveApiKey(
      providerApiKey(def),
      process.env[def.apiKeysPoolEnv],
      def.name,
    ) || undefined;
  }

  private buildClient(apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: providerBaseUrl(this.def) || 'https://api.githubcopilot.com',
      defaultHeaders: {
        'editor-version': 'carina/0.1.1',
        'Copilot-Integration-Id': 'vscode-chat',
      },
    });
  }

  private resolveSystem(messages: Message[]): { prompt: string; cacheKey: string } {
    const extracted = getCachedSystemPrompt(messages);
    return {
      prompt: extracted.systemPrompt,
      cacheKey: extracted.cacheKey,
    };
  }

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const { prompt, cacheKey } = this.resolveSystem(messages);
    const toolDefs = openaiTools(tools);
    const cacheKeyHeader = openaiPromptCacheKey(prompt);

    const run = async (apiKey: string) => {
      const client = this.buildClient(apiKey);
      const copilotModel = model ?? this.defaultModel;

      let response;
      try {
        response = await client.chat.completions.create({
          model: copilotModel,
          max_tokens: 8192,
          messages: toOpenAIMessages(messages, prompt),
          ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
          ...(cacheKeyHeader ? { user: `carina-cache-${cacheKeyHeader}` } : {}),
        } as any, { signal: llmRequestSignal() });
      } catch (err) {
        if (isAbortLikeError(err)) {
          throw new Error(`Copilot request timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
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

    if (this.fixedApiKey) return run(this.fixedApiKey);

    return withCredentialRotation(
      this.def.name,
      providerApiKey(this.def),
      process.env[this.def.apiKeysPoolEnv],
      async (apiKey) => run(apiKey),
    );
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const apiKey = this.fixedApiKey
      ?? resolveApiKey(providerApiKey(this.def), process.env[this.def.apiKeysPoolEnv], this.def.name)
      ?? '';
    const client = this.buildClient(apiKey);
    const { prompt } = this.resolveSystem(messages);
    const toolDefs = openaiTools(tools);
    const copilotModel = model ?? this.defaultModel;

    let stream;
    try {
      stream = await client.chat.completions.create({
        model: copilotModel,
        max_tokens: 8192,
        stream: true,
        messages: toOpenAIMessages(messages, prompt),
        ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
      } as any, { signal: llmRequestSignal() });
    } catch (err) {
      if (isAbortLikeError(err)) {
        throw new Error(`Copilot stream timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
      }
      throw err;
    }

    const acc = new Map<number, { id: string; name: string; args: string }>();
    try {
      for await (const chunk of stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
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
        throw new Error(`Copilot stream timed out after ${Math.round(llmRequestTimeoutMs() / 1000)}s`);
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

/* ── Plugin export ── */

const COPILOT_DEF: ProviderDefinition = {
  name: 'github-copilot',
  displayName: 'GitHub Copilot',
  kind: 'openai',
  apiKeyEnv: 'GITHUB_TOKEN',
  apiKeysPoolEnv: 'GITHUB_TOKENS',
  modelEnv: 'GITHUB_COPILOT_MODEL',
  defaultModel: 'gpt-4o',
  baseUrl: 'https://api.githubcopilot.com',
  baseUrlEnv: 'GITHUB_COPILOT_BASE_URL',
  capabilities: { chat: true, vision: true, streaming: true, tools: true },
  usdPerToken: 0,
  fallbackPriority: 95,
  status: 'active',
  authType: 'api-key',
  setupNote: 'Run "gh auth token" and set GITHUB_TOKEN. Requires GitHub Copilot access (free for individual devs).',
  tags: buildRoutingTags(
    {
      name: 'github-copilot',
      local: false,
      fallbackPriority: 95,
      capabilities: { chat: true, vision: true, streaming: true, tools: true },
      usdPerToken: 0,
    },
    { cost: 'free', speed: 'balanced', chat: true, code: true, vision: true, longContext: false, toolUse: true },
  ),
};

const plugin: ProviderPlugin = {
  providerDefinitions: [COPILOT_DEF],
  providerFactory: (def: ProviderDefinition) => new CopilotProvider(def),
};

export default plugin;
