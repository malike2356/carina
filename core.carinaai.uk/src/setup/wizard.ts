import fs from 'fs/promises';
import os from 'os';
import { input, select, confirm } from '@inquirer/prompts';
import { CARINA_DATA_DIR, CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';
import { installCustomDomainPack } from './custom-domain-pack.js';

type ProviderChoice = 'deepseek' | 'anthropic' | 'openai' | 'later';

export async function runSetupWizard(): Promise<void> {
  console.log('\nWelcome to Carina.\n');

  const provider = await select<ProviderChoice>({
    message: 'Which AI provider do you want to start with?',
    choices: [
      { name: 'DeepSeek (recommended - cheapest, strong quality)', value: 'deepseek' },
      { name: 'Anthropic Claude', value: 'anthropic' },
      { name: 'OpenAI GPT-4o', value: 'openai' },
      { name: "I'll configure later", value: 'later' },
    ],
  });

  const lines: string[] = ['DEFAULT_PROVIDER=' + provider];

  if (provider === 'deepseek') {
    const key = await input({ message: 'Enter your DeepSeek API key:' });
    if (key.trim()) lines.push('DEEPSEEK_API_KEY=' + key.trim());
  } else if (provider === 'anthropic') {
    const key = await input({ message: 'Enter your Anthropic API key:' });
    if (key.trim()) lines.push('ANTHROPIC_API_KEY=' + key.trim());
  } else if (provider === 'openai') {
    const key = await input({ message: 'Enter your OpenAI API key:' });
    if (key.trim()) lines.push('OPENAI_API_KEY=' + key.trim());
  }

  const customPackSource = await input({
    message: 'Install a custom domain pack? [skip / enter URL or path]',
    default: 'skip',
  });

  let activePack: string | null = null;
  if (customPackSource.trim() && customPackSource.trim().toLowerCase() !== 'skip') {
    try {
      activePack = await installCustomDomainPack(customPackSource);
      if (activePack) lines.push('ACTIVE_SKILL_PACK=' + activePack);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Custom domain pack install skipped:', msg);
    }
  }

  const connectScout = await confirm({
    message: 'Connect to Labyrinth Scout for AI agent security monitoring? (https://labyrinthscout.com)',
    default: false,
  });

  if (connectScout) {
    const scoutKey = await input({
      message: 'Paste your Labyrinth Scout API key (register at https://console.labyrinthscout.com/account/register):',
    });
    if (scoutKey.trim()) {
      lines.push('LABYRINTH_ENABLED=true');
      lines.push('LABYRINTH_URL=https://console.labyrinthscout.com');
      lines.push('LABYRINTH_API_KEY=' + scoutKey.trim());
      lines.push('LABYRINTH_INSTANCE_ID=carina-' + os.hostname());
      lines.push('LABYRINTH_INSTANCE_NAME=Carina (' + os.hostname() + ')');
    } else {
      console.log('No key entered - skipping Scout pairing. Run "carina setup" again anytime to connect.');
    }
    console.log(
      'Least-privilege defaults: keep shell-exec and email-send disabled until needed. See Scout docs/trust/least-privilege-defaults.md',
    );
  }

  lines.push('DATABASE_URL=postgresql://localhost:5432/carina');
  lines.push('REDIS_URL=redis://localhost:6379');

  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.mkdir(CARINA_DATA_DIR, { recursive: true });
  await fs.writeFile(CARINA_ENV_PATH, lines.join('\n') + '\n', { mode: 0o600 });

  console.log('\nSetup complete. Run "carina" to start.\n');
  if (!activePack) console.log('Carina is configured as a general-purpose agent with no domain pack.\n');
}

export async function ensureCarinaHome(): Promise<void> {
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.mkdir(CARINA_DATA_DIR, { recursive: true });
}
