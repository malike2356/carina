import path from 'path';
import { confirm, input, password, select } from '@inquirer/prompts';
import { CARINA_ENV_PATH, CARINA_HOME } from '../../config/paths.js';
import { type ProviderName } from '../config/defaults.js';
import { format } from '../output/formatter.js';
import { installCustomDomainPack } from '../../setup/custom-domain-pack.js';
import { isInteractiveTerminal, writeMinimalBootstrap } from '../first-run.js';
import {
  persistProviderBootstrap,
  PROVIDER_MODELS,
  testProviderConnection,
} from '../provider-bootstrap.js';
import { runFirstRunOnboarding } from '../first-run-onboarding.js';

export async function runCliSetup(args: string[] = []): Promise<void> {
  if (args.includes('--full')) {
    const { runSetupWizard } = await import('../../setup/wizard.js');
    await runSetupWizard();
    return;
  }

  if (args.includes('--provider-only')) {
    await runProviderOnlySetup();
    return;
  }

  console.log(format.title('\nCarina setup\n'));

  if (!isInteractiveTerminal()) {
    await writeMinimalBootstrap();
    console.log(format.success(`\nConfig written to ${path.join(CARINA_HOME, 'config.yaml')}`));
    console.log(format.success(`Local environment written to ${CARINA_ENV_PATH}`));
    console.log(format.muted('Non-interactive mode: add an API key to ~/.carina/.env, then run carina again.'));
    return;
  }

  const ranOnboarding = await runFirstRunOnboarding();
  if (ranOnboarding) return;

  const rerun = await confirm({
    message: 'Onboarding is complete. Reconfigure provider or profile?',
    default: false,
  });
  if (!rerun) {
    console.log(format.muted('No changes made. Run carina setup --full for advanced options.'));
    return;
  }

  await runProviderOnlySetup();
}

async function runProviderOnlySetup(): Promise<void> {
  const provider = await select<ProviderName>({
    message: 'Default provider',
    choices: [
      { name: 'DeepSeek', value: 'deepseek' },
      { name: 'Anthropic Claude', value: 'anthropic' },
      { name: 'OpenAI', value: 'openai' },
    ],
  });

  const defaultModel = PROVIDER_MODELS[provider];
  const model = await input({
    message: 'Default model',
    default: defaultModel,
  });

  const apiKey = await password({
    message: `${provider} API key`,
    mask: '*',
    validate: (value) => (value.trim().length > 0 ? true : 'API key is required for setup now'),
  });

  const runTest = await confirm({
    message: 'Test provider connection before saving?',
    default: true,
  });

  if (runTest) {
    console.log(format.muted('\nTesting provider connection...'));
    try {
      await testProviderConnection(provider, apiKey, model || defaultModel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(format.error(`\nConnection test failed: ${msg}`));
      const saveAnyway = await confirm({
        message: 'Save config anyway?',
        default: false,
      });
      if (!saveAnyway) {
        console.log(format.muted('Setup cancelled. Run carina setup to try again.'));
        return;
      }
    }
  }

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

  const extraLines = activePack ? [`ACTIVE_SKILL_PACK=${activePack}`] : [];
  await persistProviderBootstrap(
    { provider, model: model || defaultModel, apiKey },
    extraLines,
  );

  console.log(format.success(`\nConfig written to ${path.join(CARINA_HOME, 'config.yaml')}`));
  console.log(format.success('Local environment written to ~/.carina/.env'));
  if (!activePack) console.log(format.muted('Carina is configured as a general-purpose agent with no domain pack.'));
}
