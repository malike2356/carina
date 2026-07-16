const PROVIDER_ENV: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  together: 'TOGETHER_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  cohere: 'COHERE_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  xai: 'XAI_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  qwen: 'DASHSCOPE_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  deepinfra: 'DEEPINFRA_API_KEY',
  novita: 'NOVITA_API_KEY',
  siliconflow: 'SILICONFLOW_API_KEY',
  ollama: 'OLLAMA_API_KEY',
  lmstudio: 'LMSTUDIO_API_KEY',
  vllm: 'VLLM_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  'labyrinth-scout': 'LABYRINTH_API_KEY',
};

export function providerEnvVar(provider: string): string {
  const normalized = provider.toLowerCase();
  return PROVIDER_ENV[normalized] ?? `${normalized.toUpperCase().replace(/-/g, '_')}_API_KEY`;
}

export function applyProviderEnv(
  keys: Array<{ provider: string; apiKey: string }>,
): () => void {
  const previous = new Map<string, string | undefined>();
  for (const { provider, apiKey } of keys) {
    const envName = providerEnvVar(provider);
    previous.set(envName, process.env[envName]);
    process.env[envName] = apiKey;
  }
  return () => {
    for (const [envName, value] of previous) {
      if (value === undefined) {
        delete process.env[envName];
      } else {
        process.env[envName] = value;
      }
    }
  };
}
