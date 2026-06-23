import { confirm, input, password, select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  KNOWN_LLM_PROVIDERS,
  PROVIDER_MAP,
  isProviderConfigured,
} from '../../brain/provider-registry.js';
import { loadFromYaml, setConfigOrSecret, setConfigValue } from '../config/loader.js';
import { loadLocalEnv } from '../config/env.js';
import { runModelCommand } from './model.js';

async function changeProviderAndModel(): Promise<void> {
  const provider = await select({
    message: 'LLM provider',
    choices: KNOWN_LLM_PROVIDERS.map((name) => {
      const def = PROVIDER_MAP[name];
      const ready = isProviderConfigured(def);
      return {
        name: `${def.displayName} (${name})${ready ? '' : ' - needs API key'}`,
        value: name,
      };
    }),
  });

  const def = PROVIDER_MAP[provider];
  if (!isProviderConfigured(def)) {
    const addKey = await confirm({
      message: `Set API key for ${def.displayName} now?`,
      default: true,
    });
    if (addKey) {
      const key = await password({ message: `${def.apiKeyEnv}` });
      if (key.trim()) {
        await setConfigOrSecret(def.apiKeyEnv, key.trim());
        loadLocalEnv();
      }
    }
  }

  const model = await input({
    message: 'Model name',
    default: def.defaultModel,
  });

  await setConfigValue('provider', provider);
  await setConfigValue('model', model);
  console.log(chalk.green(`Saved default: ${provider}/${model}`));

  const testNow = await confirm({ message: 'Test this provider now?', default: true });
  if (testNow && isProviderConfigured(def)) {
    await runModelCommand(['test', provider]);
  }
}

export async function runModelInteractiveMenu(): Promise<void> {
  console.log(chalk.cyan.bold('\n  Carina model configuration\n'));

  let done = false;
  while (!done) {
    const config = await loadFromYaml();
    const action = await select({
      message: `Current: ${config.provider}/${config.model}`,
      choices: [
        { name: 'Change provider and model', value: 'change' },
        { name: 'Quick pick (provider + model)', value: 'pick' },
        { name: 'Set API key for a provider', value: 'apikey' },
        { name: 'Test current provider', value: 'test' },
        { name: 'List all providers', value: 'list' },
        { name: 'Show current model', value: 'current' },
        { name: 'Done', value: 'done' },
      ],
    });

    if (action === 'done') {
      done = true;
      continue;
    }

    if (action === 'change') {
      await changeProviderAndModel();
      continue;
    }

    if (action === 'pick') {
      await runModelCommand(['pick']);
      continue;
    }

    if (action === 'apikey') {
      const provider = await select({
        message: 'Provider',
        choices: KNOWN_LLM_PROVIDERS.map((name) => ({
          name: `${PROVIDER_MAP[name].displayName} (${name})`,
          value: name,
        })),
      });
      const def = PROVIDER_MAP[provider];
      const key = await password({ message: def.apiKeyEnv });
      if (key.trim()) {
        await setConfigOrSecret(def.apiKeyEnv, key.trim());
        loadLocalEnv();
        console.log(chalk.green(`Saved ${def.apiKeyEnv} to .env`));
      }
      continue;
    }

    if (action === 'test') {
      await runModelCommand(['test']);
      continue;
    }

    if (action === 'list') {
      await runModelCommand(['list']);
      continue;
    }

    if (action === 'current') {
      await runModelCommand(['current']);
    }
  }

  console.log(chalk.gray('\nModel config saved to ~/.carina/config.yaml\n'));
}
