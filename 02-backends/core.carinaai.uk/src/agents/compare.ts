import { llm, type ProviderOverride } from '../brain/llm.js';
import { PROVIDER_MAP, isProviderConfigured, providerModel } from '../brain/provider-registry.js';
import type { Message } from '../types/index.js';

export interface CompareOptions {
  prompt: string;
  providers: string[];
  blind?: boolean;
  maxTokens?: number;
  systemPrompt?: string;
  outputFormat?: 'terminal' | 'markdown';
}

export interface CompareResponseItem {
  providerId: string;
  model: string;
  response: string;
  latencyMs: number;
  tokenCount?: number;
  error?: string;
}

export interface CompareResult {
  prompt: string;
  responses: CompareResponseItem[];
  generatedAt: string;
}

export type CompareChatFn = (
  messages: Message[],
  tools?: undefined,
  override?: ProviderOverride,
) => Promise<{
  content: string;
  provider: string;
  tokensOut: number;
  tokensUsed: number;
}>;

function buildMessages(prompt: string, systemPrompt?: string, maxTokens?: number): Message[] {
  const messages: Message[] = [];
  const limitNote = maxTokens
    ? `Keep the response under ${maxTokens} tokens.`
    : 'Keep the response concise.';
  const system = [systemPrompt, limitNote].filter(Boolean).join('\n\n');
  if (system) {
    messages.push({ role: 'system', content: system, timestamp: new Date() });
  }
  messages.push({ role: 'user', content: prompt, timestamp: new Date() });
  return messages;
}

export async function queryProvider(
  providerId: string,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
  chatFn: CompareChatFn,
): Promise<CompareResponseItem> {
  const def = PROVIDER_MAP[providerId];
  const model = def ? providerModel(def) : providerId;
  if (!def || !isProviderConfigured(def) || !llm.isProviderConfigured(providerId)) {
    return {
      providerId,
      model,
      response: '',
      latencyMs: 0,
      error: `Provider "${providerId}" is not configured`,
    };
  }

  const started = Date.now();
  try {
    const result = await chatFn(
      buildMessages(prompt, systemPrompt, maxTokens),
      undefined,
      { name: providerId },
    );
    return {
      providerId,
      model,
      response: result.content,
      latencyMs: Date.now() - started,
      tokenCount: result.tokensOut || result.tokensUsed,
    };
  } catch (err) {
    return {
      providerId,
      model,
      response: '',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runCompare(
  options: CompareOptions,
  chatFn: CompareChatFn = (messages, tools, override) => llm.chat(messages, tools, override),
): Promise<CompareResult> {
  const tasks = options.providers.map((providerId) =>
    queryProvider(providerId, options.prompt, options.systemPrompt, options.maxTokens, chatFn),
  );
  const settled = await Promise.allSettled(tasks);
  const responses = settled.map((entry, index) => {
    if (entry.status === 'fulfilled') return entry.value;
    const providerId = options.providers[index] ?? 'unknown';
    return {
      providerId,
      model: providerId,
      response: '',
      latencyMs: 0,
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    };
  });

  return {
    prompt: options.prompt,
    responses,
    generatedAt: new Date().toISOString(),
  };
}

export function defaultCompareProviders(limit = 3): string[] {
  return llm.list().filter((name) => llm.isProviderConfigured(name)).slice(0, limit);
}

function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function providerLabel(item: CompareResponseItem): string {
  return `${item.providerId} (${item.model})`;
}

export function formatCompareTerminal(
  result: CompareResult,
  blind = false,
): string {
  const lines: string[] = [`Prompt: "${result.prompt}"`, ''];
  result.responses.forEach((item, index) => {
    const label = blind
      ? `Provider ${String.fromCharCode(65 + index)}`
      : providerLabel(item);
    const meta = item.error
      ? 'error'
      : `${formatLatency(item.latencyMs)}${item.tokenCount ? ` | ${item.tokenCount} tokens` : ''}`;
    lines.push(`${label}  | ${meta}`);
    lines.push('-'.repeat(53));
    lines.push(item.error ? `Error: ${item.error}` : item.response);
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

export function formatCompareMarkdown(result: CompareResult, blind = false): string {
  const lines: string[] = [`# Model Compare`, '', `**Prompt:** ${result.prompt}`, ''];
  result.responses.forEach((item, index) => {
    const label = blind
      ? `Provider ${String.fromCharCode(65 + index)}`
      : providerLabel(item);
    lines.push(`## ${label}`);
    if (item.error) {
      lines.push(`Error: ${item.error}`);
    } else {
      lines.push(item.response);
      lines.push('');
      lines.push(`_${formatLatency(item.latencyMs)}${item.tokenCount ? `, ${item.tokenCount} tokens` : ''}_`);
    }
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

export function formatCompareGateway(
  result: CompareResult,
  plainTextChannel = false,
): string {
  return result.responses.map((item, index) => {
    const label = plainTextChannel
      ? `Response ${index + 1}`
      : `${item.providerId} (${item.model})`;
    const meta = item.error ? 'error' : formatLatency(item.latencyMs);
    const body = item.error ? `Error: ${item.error}` : item.response;
    return `${label} | ${meta}\n${body}`;
  }).join('\n\n');
}

export function revealBlindCompare(result: CompareResult): string {
  return result.responses.map((item, index) => {
    const blindLabel = `Provider ${String.fromCharCode(65 + index)}`;
    return `${blindLabel} -> ${providerLabel(item)}`;
  }).join('\n');
}
