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
    keys[0];
  const config = PROVIDER_ENDPOINTS[preferred.provider];
  if (!config) {
    throw new Error(`Provider ${preferred.provider} is not supported for cloud assist yet.`);
  }
  return { ...preferred, ...config, model: modelOverride || config.model };
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
