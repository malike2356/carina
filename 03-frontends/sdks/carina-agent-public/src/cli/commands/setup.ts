import fs from 'fs/promises';
import path from 'path';
import { input, password, select } from '@inquirer/prompts';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { CARINA_ENV_PATH, CARINA_HOME } from '../../config/paths.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from '../config/defaults.js';
import { envKeyForProvider } from '../config/env.js';
import { writeConfig, type CarinaCliConfig } from '../config/loader.js';
import { format } from '../output/formatter.js';
import { installCustomDomainPack } from '../../setup/custom-domain-pack.js';

const MODELS: Record<ProviderName, string> = {
  deepseek: 'deepseek-chat',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

async function testProviderConnection(provider: ProviderName, apiKey: string, model: string): Promise<void> {
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

export async function runCliSetup(): Promise<void> {
  console.log(format.title('\nCarina setup\n'));

  const provider = await select<ProviderName>({
    message: 'Default provider',
    choices: [
      { name: 'DeepSeek', value: 'deepseek' },
      { name: 'Anthropic Claude', value: 'anthropic' },
      { name: 'OpenAI', value: 'openai' },
    ],
  });

  const defaultModel = MODELS[provider];
  const model = await input({
    message: 'Default model',
    default: defaultModel,
  });

  const apiKey = await password({
    message: `${provider} API key`,
    mask: '*',
  });

  console.log(format.muted('\nTesting provider connection...'));
  await testProviderConnection(provider, apiKey, model || defaultModel);

  const customPackSource = await input({
    message: 'Install a custom domain pack? [skip / enter URL or path]',
    default: 'skip',
  });

  let activePack: string | null = null;
  if (customPackSource.trim() && customPackSource.trim().toLowerCase() !== 'skip') {
    try {
      activePack = await installCustomDomainPack(customPackSource);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(format.muted(`Custom domain pack install skipped: ${msg}`));
    }
  }

  const config: CarinaCliConfig = {
    ...DEFAULT_CLI_CONFIG,
    provider,
    model: model || defaultModel,
    providers: {
      ...DEFAULT_CLI_CONFIG.providers,
      [provider]: {
        api_key: apiKey,
        model: model || defaultModel,
      },
    },
  };

  await fs.mkdir(CARINA_HOME, { recursive: true });
  await writeConfig(config);
  await fs.writeFile(
    CARINA_ENV_PATH,
    [
      `DEFAULT_PROVIDER=${provider}`,
      `${envKeyForProvider(provider)}=${apiKey}`,
      `DEFAULT_MODEL=${model || defaultModel}`,
      ...(activePack ? [`ACTIVE_SKILL_PACK=${activePack}`] : []),
    ].join('\n') + '\n',
    { mode: 0o600 },
  );

  console.log(format.success(`\nConfig written to ${path.join(CARINA_HOME, 'config.yaml')}`));
  console.log(format.success('Local environment written to ~/.carina/.env'));
  if (!activePack) console.log(format.muted('Carina is configured as a general-purpose agent with no domain pack.'));
}
