import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  KNOWN_LLM_PROVIDERS,
  PROVIDER_MAP,
  isProviderConfigured,
} from '../../brain/provider-registry.js';
import {
  buildCatalogRows,
  formatCompactCatalogLine,
  formatProviderCatalogHeader,
} from '../../brain/provider-catalog.js';
import { loadFromYaml, setConfigValue } from '../config/loader.js';

function isInteractiveDefault(args: string[]): boolean {
  if (args.length > 0) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function runModelCommand(args: string[]): Promise<void> {
  const action = args[0] ?? (isInteractiveDefault(args) ? 'menu' : 'pick');

  if (action === 'menu' || action === 'interactive') {
    const { runModelInteractiveMenu } = await import('./model-interactive.js');
    await runModelInteractiveMenu();
    return;
  }

  if (action === 'list') {
    console.log(chalk.bold('\nProviders\n'));
    console.log(chalk.gray(formatProviderCatalogHeader()));
    for (const row of buildCatalogRows({ includeCatalogOnly: true })) {
      console.log(`  ${formatCompactCatalogLine(row)}`);
    }
    const config = await loadFromYaml();
    console.log(`\nActive: ${config.provider} / ${config.model}\n`);
    return;
  }

  if (action === 'set') {
    const provider = args[1];
    const model = args[2];
    if (!provider || !model) {
      console.error('Usage: carina model set <provider> <model>');
      process.exit(1);
    }
    if (!PROVIDER_MAP[provider]) {
      console.error(`Unknown provider: ${provider}`);
      process.exit(1);
    }
    await setConfigValue('provider', provider);
    await setConfigValue('model', model);
    console.log(`Model set to ${provider}/${model}`);
    return;
  }

  if (action === 'current') {
    const config = await loadFromYaml();
    console.log(`${config.provider}/${config.model}`);
    return;
  }

  if (action === 'pick') {
    const provider = await select({
      message: 'LLM provider',
      choices: KNOWN_LLM_PROVIDERS.map((name) => {
        const def = PROVIDER_MAP[name];
        const ready = isProviderConfigured(def);
        return {
          name: `${def.displayName} (${name})${ready ? '' : ' - not configured'}`,
          value: name,
        };
      }),
    });
    const def = PROVIDER_MAP[provider];
    const model = await input({
      message: 'Model',
      default: def.defaultModel,
    });
    await setConfigValue('provider', provider);
    await setConfigValue('model', model);
    console.log(chalk.green(`Saved ${provider}/${model} to config.yaml`));
    return;
  }

  if (action === 'preset') {
    const { runProvidersCommand } = await import('./providers-cli.js');
    await runProvidersCommand(['preset', ...args.slice(1)]);
    return;
  }

  if (action === 'scan') {
    const { runProvidersCommand } = await import('./providers-cli.js');
    await runProvidersCommand(['scan', ...args.slice(1)]);
    return;
  }

  if (action === 'test') {
    const provider = args[1] ?? (await loadFromYaml()).provider;
    const def = PROVIDER_MAP[provider];
    if (!def) {
      console.error(`Unknown provider: ${provider}`);
      process.exit(1);
    }
    if (!isProviderConfigured(def)) {
      console.error(`Provider not configured: ${provider}`);
      process.exit(1);
    }
    const { LLMRouter } = await import('../../brain/llm.js');
    const router = new LLMRouter();
    router.use(provider);
    const res = await router.chat([{ role: 'user', content: 'Reply with OK only.', timestamp: new Date() }]);
    console.log(chalk.green('ok'), res.content?.slice(0, 80));
    return;
  }

  console.error('Usage: carina model <menu|list|set|pick|current|preset|scan|test> [provider] [model]');
  process.exit(1);
}
