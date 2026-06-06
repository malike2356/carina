import fs from 'fs/promises';
import path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import { CARINA_DATA_DIR, CARINA_ENV_PATH, CARINA_HOME } from '../config/paths.js';

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

  const installProperty = await confirm({
    message: 'Install the UK Property skill pack? (Recommended if you work in UK property)',
    default: true,
  });

  if (installProperty) {
    lines.push('ACTIVE_SKILL_PACK=property-uk');
  }

  lines.push('DATABASE_URL=postgresql://localhost:5432/carina');
  lines.push('REDIS_URL=redis://localhost:6379');

  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.mkdir(CARINA_DATA_DIR, { recursive: true });
  await fs.writeFile(CARINA_ENV_PATH, lines.join('\n') + '\n', { mode: 0o600 });

  console.log('\nSetup complete. Run "carina" to start.\n');

  if (installProperty) {
    const { installPack } = await import('./install-pack.js');
    try {
      await installPack('property-uk');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Property pack install skipped:', msg);
      console.warn('Run: carina install-pack property-uk');
    }
  }
}

export async function ensureCarinaHome(): Promise<void> {
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.mkdir(CARINA_DATA_DIR, { recursive: true });
}
