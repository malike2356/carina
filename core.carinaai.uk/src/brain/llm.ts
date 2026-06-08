import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import {
  anthropicTools,
  openaiTools,
  toAnthropicMessages,
  toOpenAIMessages,
} from './messages.js';
import { classifyComplexity, type TaskComplexity } from './task-classifier.js';
import type { Message, CarinaResponse, LLMProvider, Tool, ToolCall } from '../types/index.js';

const SYSTEM_PROMPT = `You are Carina, an autonomous AI agent built by VERLOX Ltd.

You are not a chatbot. You are an agent. You take actions, execute tasks, remember context, and improve over time.

Your principles:
- Complete tasks fully, do not explain what you would do, do it
- Use tools when you need to interact with the world
- Be direct and concise in responses
- If you cannot complete a task, say exactly why and what is needed
- You remember past conversations and build on them
- Never use emojis, emoticons, or Unicode symbols in any response. Use plain text only.
- Never use em dashes. Use commas, colons, or full stops instead.
- Only answer what is asked. Do not volunteer unrequested analysis.

You have access to tools for: web search, file operations, email, HTTP requests, shell, and code execution.
Use them proactively when they will help complete the task.`;

export type ProviderName = 'deepseek' | 'anthropic' | 'openai';

export interface ProviderOverride {
  name: string;
  model?: string;
}

const DEFAULT_PROVIDER_MODELS: Record<ProviderName, string> = {
  deepseek: config.deepseek.model,
  anthropic: config.anthropic.model,
  openai: config.openai.model,
};

export const KNOWN_LLM_PROVIDERS = Object.keys(DEFAULT_PROVIDER_MODELS) as ProviderName[];

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

// --- Claude ---
export class ClaudeProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const toolDefs = anthropicTools(tools);
    const response = await this.client.messages.create({
      model: model ?? config.anthropic.model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: toAnthropicMessages(messages),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');

    const toolsUsed = response.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => (b.type === 'tool_use' ? b.name : ''));
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
      toolsUsed,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      provider: 'anthropic',
      toolCalls,
    };
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const toolDefs = anthropicTools(tools);
    const stream = this.client.messages.stream({
      model: model ?? config.anthropic.model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: toAnthropicMessages(messages),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
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

// --- DeepSeek (OpenAI-compatible API) ---
export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const toolDefs = openaiTools(tools);
    const response = await this.client.chat.completions.create({
      model: model ?? config.deepseek.model,
      max_tokens: 8192,
      messages: toOpenAIMessages(messages, SYSTEM_PROMPT),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    const msg = response.choices[0]?.message;
    const content = msg?.content ?? '';
    const usage = response.usage;
    const toolCalls = parseToolCallsFromOpenAI(msg?.tool_calls);
    const toolsUsed = toolCalls.map((t) => t.toolName);

    return {
      content,
      toolsUsed,
      tokensUsed: (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
      provider: 'deepseek',
      toolCalls,
    };
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const toolDefs = openaiTools(tools);
    const stream = await this.client.chat.completions.create({
      model: model ?? config.deepseek.model,
      max_tokens: 8192,
      stream: true,
      messages: toOpenAIMessages(messages, SYSTEM_PROMPT),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    const acc = new Map<number, { id: string; name: string; args: string }>();

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

// --- OpenAI ---
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
  }

  async chat(messages: Message[], tools?: Tool[], model?: string): Promise<CarinaResponse> {
    const toolDefs = openaiTools(tools);
    const response = await this.client.chat.completions.create({
      model: model ?? config.openai.model,
      max_tokens: 8192,
      messages: toOpenAIMessages(messages, SYSTEM_PROMPT),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    const msg = response.choices[0]?.message;
    const content = msg?.content ?? '';
    const usage = response.usage;
    const toolCalls = parseToolCallsFromOpenAI(msg?.tool_calls);
    const toolsUsed = toolCalls.map((t) => t.toolName);

    return {
      content,
      toolsUsed,
      tokensUsed: (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
      provider: 'openai',
      toolCalls,
    };
  }

  async *stream(messages: Message[], tools?: Tool[], model?: string): AsyncGenerator<string | ToolCall> {
    const toolDefs = openaiTools(tools);
    const stream = await this.client.chat.completions.create({
      model: model ?? config.openai.model,
      max_tokens: 8192,
      stream: true,
      messages: toOpenAIMessages(messages, SYSTEM_PROMPT),
      ...(toolDefs.length > 0 ? { tools: toolDefs } : {}),
    });

    const acc = new Map<number, { id: string; name: string; args: string }>();

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

// --- Router: picks provider based on config, falls back automatically ---
export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private active: string;
  private activeModels: Map<string, string> = new Map();

  constructor() {
    if (config.deepseek.apiKey)  this.providers.set('deepseek',  new DeepSeekProvider());
    if (config.anthropic.apiKey) this.providers.set('anthropic', new ClaudeProvider());
    if (config.openai.apiKey)    this.providers.set('openai',    new OpenAIProvider());

    this.active = config.carina.defaultProvider;

    if (!this.providers.has(this.active)) {
      this.active = this.providers.keys().next().value ?? 'deepseek';
    }
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
    if (!provider) throw new Error(`No provider available. Check your .env API keys.`);
    return provider;
  }

  currentModel(): string {
    return this.modelFor(this.active);
  }

  modelFor(provider: string): string {
    return this.activeModels.get(provider) ?? DEFAULT_PROVIDER_MODELS[provider as ProviderName] ?? '';
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

  // Fallback order: DeepSeek (primary) -> Claude -> OpenAI
  private fallbackOrder(override?: ProviderOverride): Array<{ provider: LLMProvider; model?: string }> {
    const order = ['deepseek', 'anthropic', 'openai'];
    const activeName = override?.name ?? this.active;
    const active = this.providers.get(activeName);
    const rest = order
      .filter(n => n !== activeName)
      .map(n => this.providers.get(n))
      .filter((p): p is LLMProvider => p !== undefined);
    const activeModel = override?.model ?? (activeName ? this.activeModels.get(activeName) : undefined);
    const providers = active ? [active, ...rest] : rest;
    return providers.map((provider) => ({
      provider,
      model: provider.name === activeName ? activeModel : this.activeModels.get(provider.name),
    }));
  }

  async chat(messages: Message[], tools?: Tool[], override?: ProviderOverride): Promise<CarinaResponse> {
    const providers = this.fallbackOrder(override);
    return this.chatWithProviders(providers, messages, tools);
  }

  async chatRouted(
    messages: Message[],
    tools?: Tool[],
    classification: TaskComplexity = classifyComplexity(messages),
    override?: ProviderOverride,
  ): Promise<CarinaResponse> {
    if (override) return this.chat(messages, tools, override);
    const startProvider = classification === 'simple' ? this.cheap().name : this.current().name;
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
        return await provider.chat(messages, tools, model);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
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

  // DeepSeek -> OpenAI -> Claude for cheap meta-calls (skill eval, orchestration)
  cheap(): LLMProvider {
    for (const name of ['deepseek', 'openai', 'anthropic']) {
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
