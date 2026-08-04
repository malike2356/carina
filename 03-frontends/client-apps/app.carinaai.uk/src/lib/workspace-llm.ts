import { ChatStreamError } from '@/lib/chat-errors';

const PROVIDER_ENDPOINTS: Record<string, { url: string; model: string }> = {
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
  },
  together: {
    url: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-flash-latest',
  },
};

export type PlaygroundThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export type PlaygroundToolFlags = {
  webSearch?: boolean;
  codeExecution?: boolean;
  structuredOutputs?: boolean;
};

function resolveProvider(
  keys: Array<{ provider: string; apiKey: string }>,
  providerOverride?: string,
  modelOverride?: string,
) {
  if (keys.length === 0) {
    throw new ChatStreamError('No API keys configured for this workspace.', 'NO_BYOK_KEYS');
  }

  const preferred =
    (providerOverride ? keys.find((key) => key.provider === providerOverride) : null) ??
    keys.find((key) => key.provider === 'deepseek') ??
    keys.find((key) => key.provider === 'openai') ??
    keys.find((key) => key.provider === 'google') ??
    keys[0];
  const config = PROVIDER_ENDPOINTS[preferred.provider];
  if (!config) {
    throw new ChatStreamError(
      `Provider ${preferred.provider} is not supported in Lab Playground yet. Use OpenAI, Google, DeepSeek, Groq, OpenRouter, Together, or Mistral.`,
      'PROVIDER_ERROR',
    );
  }
  return { ...preferred, ...config, model: modelOverride || config.model };
}

function thinkingPreamble(level: PlaygroundThinkingLevel): string {
  switch (level) {
    case 'off':
      return 'Respond directly. Do not show a long chain of thought.';
    case 'low':
      return 'Keep reasoning brief. Prefer a short answer.';
    case 'high':
      return 'Think carefully before answering. Show key reasoning steps when helpful, then give a clear final answer.';
    case 'medium':
    default:
      return 'Balance depth and speed. Reason when needed, then answer clearly.';
  }
}

function toolsPreamble(tools: PlaygroundToolFlags): string {
  const lines: string[] = [];
  if (tools.webSearch) {
    lines.push(
      'Web grounding is enabled for this run. Prefer current, citable facts when the question needs them. If you lack live search results, say what you would search and answer carefully.',
    );
  }
  if (tools.codeExecution) {
    lines.push(
      'Code execution preference is on. Prefer concrete runnable snippets. Note that Lab Playground does not execute code live; mark examples as illustrative unless the user pastes output.',
    );
  }
  if (tools.structuredOutputs) {
    lines.push(
      'Structured output is required. Reply with a single valid JSON object only. No markdown fences.',
    );
  }
  return lines.join('\n');
}

export function buildPlaygroundSystemPrompt(input: {
  systemPrompt?: string;
  thinkingLevel?: PlaygroundThinkingLevel;
  tools?: PlaygroundToolFlags;
}): string {
  const base =
    input.systemPrompt?.trim() ||
    'You are Aiva Lab Playground, a safe experiment console inside the Aiva AI-employee OS.';
  const parts = [
    base,
    thinkingPreamble(input.thinkingLevel ?? 'medium'),
    toolsPreamble(input.tools ?? {}),
  ].filter(Boolean);
  return parts.join('\n\n');
}

export async function completeWorkspacePrompt(
  keys: Array<{ provider: string; apiKey: string }>,
  systemPrompt: string,
  userPrompt: string,
  options?: { provider?: string; model?: string },
): Promise<string> {
  const provider = resolveProvider(keys, options?.provider, options?.model);
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ChatStreamError(text || `Provider request failed (${res.status})`, 'PROVIDER_ERROR');
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ChatStreamError('Empty response from model', 'PROVIDER_ERROR');
  }
  return content;
}

export async function streamWorkspacePlayground(input: {
  keys: Array<{ provider: string; apiKey: string }>;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider?: string;
  model?: string;
  temperature?: number;
  structuredOutputs?: boolean;
}): Promise<Response> {
  const provider = resolveProvider(input.keys, input.provider, input.model);
  const temperature = Math.min(2, Math.max(0, Number(input.temperature ?? 1)));
  const body: Record<string, unknown> = {
    model: provider.model,
    stream: true,
    temperature,
    messages: [
      { role: 'system', content: input.systemPrompt },
      ...input.messages.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 12000),
      })),
    ],
  };
  if (input.structuredOutputs && (provider.provider === 'openai' || provider.provider === 'groq')) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ChatStreamError(text || `Provider request failed (${res.status})`, 'PROVIDER_ERROR');
  }
  return res;
}
