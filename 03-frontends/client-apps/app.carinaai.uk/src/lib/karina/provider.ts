export type KarinaProviderConfig = {
  url: string;
  key: string;
  model: string;
};

export function resolveKarinaProvider(): KarinaProviderConfig | null {
  const modelOverride = process.env.KARINA_HELP_MODEL?.trim();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const helpKey = process.env.KARINA_HELP_API_KEY?.trim();
  const prefer = process.env.KARINA_HELP_PROVIDER?.trim().toLowerCase();

  if (prefer === 'openai' && (openaiKey || helpKey)) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: (openaiKey || helpKey)!,
      model: modelOverride || 'gpt-4o-mini',
    };
  }

  if (deepseekKey || (helpKey && prefer !== 'openai')) {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: (deepseekKey || helpKey)!,
      model: modelOverride || 'deepseek-chat',
    };
  }

  if (openaiKey || helpKey) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: (openaiKey || helpKey)!,
      model: modelOverride || 'gpt-4o-mini',
    };
  }

  return null;
}
