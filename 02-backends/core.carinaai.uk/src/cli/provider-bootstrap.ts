import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from './config/defaults.js';
import { envKeyForProvider } from './config/env.js';
import { setProviderPool } from '../credentials/store.js';
import { writeConfig, type CarinaCliConfig } from './config/loader.js';

export const PROVIDER_MODELS: Record<ProviderName, string> = {
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};

const LLM_KEY_PATTERN = /^(DEEPSEEK|ANTHROPIC|OPENAI|GEMINI|GROQ)_API_KEY=/m;

export function carinaEnvPath(home = resolveCarinaHome()): string {
  return path.join(home, '.env');
}

export function hasLlmApiKeyInEnvContents(contents: string): boolean {
  return LLM_KEY_PATTERN.test(contents);
}

export function hasLlmApiKeyInProcessEnv(): boolean {
  return Boolean(
    process.env.DEEPSEEK_API_KEY?.trim()
      || process.env.ANTHROPIC_API_KEY?.trim()
      || process.env.OPENAI_API_KEY?.trim()
      || process.env.GEMINI_API_KEY?.trim()
      || process.env.GROQ_API_KEY?.trim(),
  );
}

export async function readEnvFileContents(envPath = carinaEnvPath()): Promise<string> {
  try {
    return await fs.readFile(envPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function testProviderConnection(
  provider: ProviderName,
  apiKey: string,
  model: string,
): Promise<void> {
  if (!apiKey.trim()) return;

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
    });
    return;
  }

  if (provider === 'gemini') {
    const client = new GoogleGenerativeAI(apiKey);
    const genModel = client.getGenerativeModel({ model });
    await genModel.generateContent('Reply with OK.');
    return;
  }

  const client = new OpenAI({
    apiKey,
    ...(provider === 'deepseek' ? { baseURL: 'https://api.deepseek.com/v1' } : {}),
  });
  await client.chat.completions.create({
    model,
    max_tokens: 8,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  });
}

export type ProviderBootstrapInput = {
  provider: ProviderName;
  model: string;
  apiKey: string;
};

export const LOCAL_MEMORY_ENV_LINES = [
  'CARINA_LOCAL_MODE=true',
  'CARINA_SKIP_POSTGRES=true',
  'CARINA_MEMORY_BACKEND=builtin',
] as const;

function envContentsHasDatabaseConfig(contents: string, extraLines: string[] = []): boolean {
  const keys = new Set<string>();
  for (const line of [...contents.split('\n'), ...extraLines]) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    keys.add(trimmed.slice(0, eq));
  }
  return keys.has('DATABASE_URL') || keys.has('CARINA_SKIP_POSTGRES');
}

export async function ensureOperatorMemoryEnv(
  extraLines: string[] = [],
  envPath = carinaEnvPath(),
): Promise<void> {
  const existing = await readEnvFileContents(envPath);
  if (envContentsHasDatabaseConfig(existing, extraLines)) return;
  await mergeEnvLines([...LOCAL_MEMORY_ENV_LINES], envPath);
}

export async function persistProviderBootstrap(
  input: ProviderBootstrapInput,
  extraEnvLines: string[] = [],
): Promise<void> {
  const { provider, model, apiKey } = input;
  const home = resolveCarinaHome();
  const envPath = carinaEnvPath(home);
  const config: CarinaCliConfig = {
    ...DEFAULT_CLI_CONFIG,
    provider,
    model,
    providers: {
      ...DEFAULT_CLI_CONFIG.providers,
      [provider]: {
        api_key: apiKey,
        model,
      },
    },
  };

  await fs.mkdir(home, { recursive: true });
  await writeConfig(config);

  const lines = [
    `DEFAULT_PROVIDER=${provider}`,
    `${envKeyForProvider(provider)}=${apiKey}`,
    `DEFAULT_MODEL=${model}`,
    ...extraEnvLines,
  ];
  await fs.writeFile(envPath, `${lines.join('\n')}\n`, { mode: 0o600 });

  // Keep ~/.carina/credentials.json aligned so an old pooled key cannot override onboarding.
  setProviderPool(provider, { keys: [apiKey], index: 0, failures: {} });
  await ensureOperatorMemoryEnv(extraEnvLines, envPath);
}

export async function mergeEnvLines(
  lines: string[],
  envPath = carinaEnvPath(),
): Promise<void> {
  const home = resolveCarinaHome();
  await fs.mkdir(home, { recursive: true });
  const existing = await readEnvFileContents(envPath);
  const map = new Map<string, string>();

  for (const line of existing.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }

  const merged = [...map.entries()].map(([key, value]) => `${key}=${value}`);
  await fs.writeFile(envPath, `${merged.join('\n')}\n`, { mode: 0o600 });
}
