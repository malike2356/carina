import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { confirm, input, password, select } from '@inquirer/prompts';
import { resolveCarinaHome } from '../config/paths.js';
import { seedWorkspaceFromProfile } from '../setup/workspace-seed.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from './config/defaults.js';
import { writeConfig } from './config/loader.js';
import { format } from './output/formatter.js';
import {
  carinaEnvPath,
  hasLlmApiKeyInEnvContents,
  mergeEnvLines,
  persistProviderBootstrap,
  PROVIDER_MODELS,
  readEnvFileContents,
  testProviderConnection,
} from './provider-bootstrap.js';

export const ONBOARDING_DONE_KEY = 'CARINA_ONBOARDING_DONE';

export type FirstRunGaps = {
  needsBootstrap: boolean;
  needsProfile: boolean;
  needsProvider: boolean;
};

export type FirstRunAnswers = {
  operatorName: string;
  operatorContext: string;
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
  configureLater: boolean;
};

export type FirstRunPrompts = {
  input: typeof input;
  password: typeof password;
  select: typeof select;
  confirm: typeof confirm;
};

const defaultPrompts: FirstRunPrompts = { input, password, select, confirm };

function parseEnvValue(contents: string, key: string): string {
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;
    return trimmed.slice(key.length + 1).trim();
  }
  return '';
}

export async function assessFirstRunGaps(envPath = carinaEnvPath()): Promise<FirstRunGaps> {
  const contents = await readEnvFileContents(envPath);
  const hasEnv = contents.trim().length > 0;
  const onboardingDone = parseEnvValue(contents, ONBOARDING_DONE_KEY) === 'true';

  if (hasEnv && onboardingDone) {
    return { needsBootstrap: false, needsProfile: false, needsProvider: false };
  }

  const operatorName = parseEnvValue(contents, 'CARINA_OPERATOR_NAME');
  const operatorContext = parseEnvValue(contents, 'CARINA_OPERATOR_CONTEXT');
  const hasProvider = hasLlmApiKeyInEnvContents(contents);

  return {
    needsBootstrap: !hasEnv,
    needsProfile: !operatorName.trim(),
    needsProvider: !hasProvider,
  };
}

export function printWelcomeIntro(agentName = 'Carina'): void {
  console.log('');
  console.log(chalk.bold.white(`  Hi, I'm ${agentName}.`));
  console.log(chalk.gray('  Your local AI operator agent. I run on your machine and remember what matters.'));
  console.log('');
  console.log(chalk.white('  Two quick questions, then we can talk.'));
  console.log('');
}

export async function collectFirstRunAnswers(
  gaps: FirstRunGaps,
  prompts: FirstRunPrompts = defaultPrompts,
): Promise<FirstRunAnswers> {
  let operatorName = '';
  let operatorContext = '';

  if (gaps.needsProfile) {
    operatorName = await prompts.input({
      message: 'What should I call you?',
      validate: (value) => (value.trim().length > 0 ? true : 'Your name helps me address you properly'),
    });
    operatorContext = await prompts.input({
      message: 'What are you building or working on? (one sentence, or Enter to skip)',
      default: '',
    });
  }

  if (!gaps.needsProvider) {
    return {
      operatorName: operatorName.trim(),
      operatorContext: operatorContext.trim(),
      configureLater: false,
    };
  }

  const providerChoice = await prompts.select<'now' | 'later'>({
    message: 'Connect an AI provider to start chatting, or finish GUI setup later?',
    choices: [
      { name: 'Yes, add an API key now (recommended)', value: 'now' },
      { name: 'Not yet (local mode until GUI or bootstrap config is ready)', value: 'later' },
    ],
    default: 'now',
  });

  if (providerChoice === 'later') {
    return {
      operatorName: operatorName.trim(),
      operatorContext: operatorContext.trim(),
      configureLater: true,
    };
  }

  const provider = await prompts.select<ProviderName>({
    message: 'Default provider in the GUI',
    choices: [
      { name: 'DeepSeek (recommended)', value: 'deepseek' },
      { name: 'Anthropic Claude', value: 'anthropic' },
      { name: 'OpenAI', value: 'openai' },
      { name: 'Google Gemini', value: 'gemini' },
    ],
  });

  const defaultModel = PROVIDER_MODELS[provider];
  const model = await prompts.input({
    message: 'Default model in the GUI',
    default: defaultModel,
  });

  const apiKey = await prompts.password({
    message: `${provider} API key for GUI bootstrap`,
    mask: '*',
    validate: (value) => (value.trim().length > 0 ? true : 'API key is required to chat now'),
  });

  const runTest = await prompts.confirm({
    message: 'Test provider connection before saving to GUI-backed config?',
    default: true,
  });

  if (runTest) {
    console.log(format.muted('\nTesting provider connection...'));
    try {
      await testProviderConnection(provider, apiKey, model || defaultModel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(format.error(`\nConnection test failed: ${msg}`));
      const saveAnyway = await prompts.confirm({
        message: 'Save GUI-backed config anyway?',
        default: false,
      });
      if (!saveAnyway) {
        throw new Error('Provider setup cancelled');
      }
    }
  }

  return {
    operatorName: operatorName.trim(),
    operatorContext: operatorContext.trim(),
    provider,
    model: model || defaultModel,
    apiKey,
    configureLater: false,
  };
}

function profileEnvLines(answers: FirstRunAnswers): string[] {
  const lines: string[] = [];
  if (answers.operatorName) lines.push(`CARINA_OPERATOR_NAME=${answers.operatorName}`);
  if (answers.operatorContext) lines.push(`CARINA_OPERATOR_CONTEXT=${answers.operatorContext}`);
  return lines;
}

function localModeEnvLines(): string[] {
  return [
    'CARINA_LOCAL_MODE=true',
    'CARINA_SKIP_POSTGRES=true',
    'CARINA_MEMORY_BACKEND=builtin',
    'DEFAULT_PROVIDER=deepseek',
    'DEFAULT_MODEL=deepseek-chat',
  ];
}

export async function persistFirstRunAnswers(
  answers: FirstRunAnswers,
  envPath = carinaEnvPath(),
): Promise<void> {
  const home = resolveCarinaHome();
  await fs.mkdir(home, { recursive: true });

  const sharedLines = [
    ...profileEnvLines(answers),
    `${ONBOARDING_DONE_KEY}=true`,
  ];

  if (answers.configureLater) {
    await writeConfig({ ...DEFAULT_CLI_CONFIG });
    await mergeEnvLines([...localModeEnvLines(), ...sharedLines], envPath);
    await finalizeFirstRunWorkspace(answers, home);
    return;
  }

  if (answers.provider && answers.apiKey) {
    await persistProviderBootstrap(
      {
        provider: answers.provider,
        model: answers.model ?? PROVIDER_MODELS[answers.provider],
        apiKey: answers.apiKey,
      },
      sharedLines,
    );
    await finalizeFirstRunWorkspace(answers, home);
    return;
  }

  await writeConfig({ ...DEFAULT_CLI_CONFIG });
  await mergeEnvLines(sharedLines, envPath);
  await finalizeFirstRunWorkspace(answers, home);
}

async function finalizeFirstRunWorkspace(
  answers: FirstRunAnswers,
  home = resolveCarinaHome(),
): Promise<void> {
  if (answers.operatorName) {
    process.env.CARINA_OPERATOR_NAME = answers.operatorName;
  }
  if (answers.operatorContext) {
    process.env.CARINA_OPERATOR_CONTEXT = answers.operatorContext;
  }
  await seedWorkspaceFromProfile(home);
}

export async function runFirstRunOnboarding(
  prompts: FirstRunPrompts = defaultPrompts,
): Promise<boolean> {
  const gaps = await assessFirstRunGaps();
  if (!gaps.needsBootstrap && !gaps.needsProfile && !gaps.needsProvider) {
    return false;
  }

  printWelcomeIntro();

  const answers = await collectFirstRunAnswers(gaps, prompts);
  await persistFirstRunAnswers(answers);

  console.log('');
  console.log(format.success('You are set up.'));
  if (answers.configureLater) {
    console.log(format.muted('Local mode is on. Run carina setup anytime to add an API key or use the GUI-backed settings screens.'));
  } else if (answers.apiKey) {
    console.log(format.muted('Starting your session...'));
  }

  const { isInteractiveTerminal } = await import('./first-run.js');
  if (isInteractiveTerminal()) {
    const runGateway = await prompts.confirm({
      message: 'Set up gateway and your first channel now?',
      default: true,
    });
    if (runGateway) {
      const { runGatewayOnboardingStep } = await import('./onboarding-gateway.js');
      await runGatewayOnboardingStep({ confirm: prompts.confirm, select: prompts.select });
    } else {
      const { printGatewayNextSteps } = await import('./onboarding-gateway.js');
      printGatewayNextSteps();
    }
  }

  console.log('');

  return true;
}

export function onboardingConfigPath(): string {
  return path.join(resolveCarinaHome(), 'config.yaml');
}
