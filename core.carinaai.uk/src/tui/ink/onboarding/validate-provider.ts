import OpenAI from 'openai';
import { type ProviderName } from '../../../cli/config/defaults.js';
import { testProviderConnection } from '../../../cli/provider-bootstrap.js';
import { ONBOARDING_MODELS } from './types.js';

export async function validateOnboardingProvider(
  provider: string,
  apiKey: string,
  model?: string,
): Promise<boolean> {
  const testModel = model ?? ONBOARDING_MODELS[provider]?.[0] ?? '';
  if (!apiKey.trim()) return false;

  if (provider === 'anthropic' || provider === 'openai' || provider === 'deepseek') {
    await testProviderConnection(provider as ProviderName, apiKey, testModel);
    return true;
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return false;
    return true;
  }

  if (provider === 'groq') {
    const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
    await client.chat.completions.create({
      model: testModel,
      max_tokens: 4,
      messages: [{ role: 'user', content: 'ok' }],
    });
    return true;
  }

  return false;
}
