import chalk from 'chalk';
import {
  PROVIDER_DEFINITIONS,
  isProviderConfigured,
  providerModel,
} from '../../brain/provider-registry.js';
import { loadLocalEnv } from '../config/env.js';

export async function runProvidersCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'list';

  if (action === 'list') {
    console.log(chalk.bold('\nLLM providers\n'));
    for (const def of PROVIDER_DEFINITIONS) {
      const ok = isProviderConfigured(def);
      const model = providerModel(def);
      console.log(
        `  ${def.name.padEnd(14)} ${ok ? chalk.green('configured') : chalk.gray('missing key')}  ${def.displayName}  model=${model}`,
      );
    }
    console.log('');
    return;
  }

  if (action === 'test') {
    const name = args[1];
    if (!name) {
      console.error('Usage: carina providers test <name>');
      process.exit(1);
    }
    const { runModelCommand } = await import('./model.js');
    await runModelCommand(['test', name]);
    return;
  }

  console.error('Usage: carina providers <list|test> [name]');
  process.exit(1);
}
