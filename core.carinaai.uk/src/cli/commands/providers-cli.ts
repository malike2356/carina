import chalk from 'chalk';
import {
  PROVIDER_DEFINITIONS,
  isProviderConfigured,
  providerModel,
  type ProviderDefinition,
  type ProviderStatus,
} from '../../brain/provider-registry.js';
import { describeProviderTags } from '../../brain/provider-tags.js';
import {
  getProviderHealth,
  listProviderHealth,
  probeConfiguredLocalProviders,
  probeProviderHealth,
  resetProviderHealth,
} from '../../brain/provider-health.js';
import { FREE_COPILOT_PRESET } from '../../brain/provider-routing.js';
import { llm } from '../../brain/llm.js';
import { loadLocalEnv } from '../config/env.js';
import { appendEnvValue } from '../config/loader.js';

const STATUS_ORDER: ProviderStatus[] = [
  'active', 'experimental', 'external-cli', 'oauth', 'alias', 'unsupported',
];

function statusBadge(def: ProviderDefinition): string {
  switch (def.status) {
    case 'active': return '';
    case 'experimental': return chalk.yellow('experimental');
    case 'external-cli': return chalk.cyan('external-cli');
    case 'oauth': return chalk.blue('oauth');
    case 'alias': return chalk.gray(`alias -> ${def.aliasFor}`);
    case 'unsupported': return chalk.red('unsupported');
    default: return '';
  }
}

function configuredLabel(def: ProviderDefinition): string {
  if (def.status === 'alias') return chalk.gray('use target provider');
  if (def.status === 'external-cli') return chalk.cyan('external-cli: install required');
  if (def.status === 'oauth') return chalk.blue('oauth: run setup flow');
  return isProviderConfigured(def)
    ? chalk.green('configured')
    : chalk.gray('missing key');
}

function printGroup(title: string, defs: ProviderDefinition[]): void {
  if (defs.length === 0) return;
  console.log(chalk.bold(`\n  ${title}`));
  for (const def of defs) {
    const health = getProviderHealth(def.name);
    const tags = def.status === 'active' || def.status === 'experimental'
      ? chalk.gray(`  [${describeProviderTags(def)}]`)
      : '';
    const model = def.status === 'active' || def.status === 'experimental'
      ? `  model=${providerModel(def)}`
      : '';
    const healthSuffix = health !== 'unknown' ? chalk.gray(`  health=${health}`) : '';
    const badge = statusBadge(def);
    const badgeSuffix = badge ? `  ${badge}` : '';
    const note = def.setupNote
      ? chalk.gray(`\n    Note: ${def.setupNote}`)
      : '';

    console.log(
      `    ${def.name.padEnd(20)} ${configuredLabel(def).padEnd(24)} ${def.displayName}${model}${tags}${healthSuffix}${badgeSuffix}${note}`,
    );
  }
}

export async function runProvidersCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'list';

  if (action === 'list') {
    const grouped = new Map<ProviderStatus, ProviderDefinition[]>();
    for (const s of STATUS_ORDER) grouped.set(s, []);
    for (const def of PROVIDER_DEFINITIONS) {
      grouped.get(def.status)?.push(def);
    }

    console.log(chalk.bold('\nCarina provider catalog\n'));
    printGroup('Active (routable now)', grouped.get('active') ?? []);
    printGroup('Experimental (routable, not production-hardened)', grouped.get('experimental') ?? []);
    printGroup('External CLI (install required, not routable via Carina)', grouped.get('external-cli') ?? []);
    printGroup('OAuth (requires setup flow, not routable via Carina)', grouped.get('oauth') ?? []);
    printGroup('Aliases (catalog labels, use the target provider)', grouped.get('alias') ?? []);

    const preset = llm.getPreset();
    if (preset) {
      console.log(chalk.yellow(`\nActive preset: ${preset}`));
    }
    console.log('');
    return;
  }

  if (action === 'info') {
    const name = args[1];
    if (!name) {
      console.error('Usage: carina providers info <name>');
      process.exit(1);
    }
    const def = PROVIDER_DEFINITIONS.find((d) => d.name === name);
    if (!def) {
      console.error(`Unknown provider: ${name}`);
      process.exit(1);
    }
    console.log(`\n${def.displayName}`);
    console.log(`  name:       ${def.name}`);
    console.log(`  status:     ${def.status}`);
    console.log(`  auth:       ${def.authType}`);
    if (def.status === 'active' || def.status === 'experimental') {
      console.log(`  configured: ${isProviderConfigured(def)}`);
      console.log(`  model:      ${providerModel(def)}`);
      console.log(`  tags:       ${describeProviderTags(def)}`);
      console.log(`  key env:    ${def.apiKeyEnv}`);
    }
    if (def.aliasFor) console.log(`  alias for:  ${def.aliasFor}`);
    if (def.setupNote) console.log(`  setup:      ${def.setupNote}`);
    console.log('');
    return;
  }

  if (action === 'copilot') {
    const selection = llm.copilotSelection();
    console.log(chalk.bold('\nFree Copilot preset\n'));
    console.log(chalk.gray(selection.note));
    if (selection.order.length === 0) {
      console.log(chalk.yellow('\nNo providers available for Free Copilot.'));
      console.log('Enable a local backend (OLLAMA_ENABLED, LMSTUDIO_ENABLED, VLLM_ENABLED, LLAMACPP_ENABLED) or configure API keys.');
      return;
    }
    console.log('');
    for (const [i, name] of selection.order.entries()) {
      const def = PROVIDER_DEFINITIONS.find((d) => d.name === name);
      const marker = i === 0 ? chalk.green('*') : ' ';
      console.log(`  ${marker} ${name}  ${def ? describeProviderTags(def) : ''}`);
    }
    console.log(chalk.gray('\nActivate: carina model preset free-copilot\n'));
    return;
  }

  if (action === 'health') {
    const target = args[1];
    if (target === 'reset') {
      resetProviderHealth(args[2]);
      console.log('Provider health cache cleared.');
      return;
    }
    if (target === 'probe') {
      const names = args[2]
        ? [args[2]]
        : PROVIDER_DEFINITIONS.filter((d) => d.local).map((d) => d.name);
      for (const name of names) {
        const ok = await probeProviderHealth(name);
        console.log(`${name}: ${ok ? chalk.green('healthy') : chalk.red('unhealthy')}`);
      }
      return;
    }
    const cached = listProviderHealth();
    if (cached.length === 0) {
      console.log('No cached provider health yet. Run: carina providers health probe');
      return;
    }
    for (const row of cached) {
      console.log(`  ${row.name.padEnd(14)} ${row.state}${row.detail ? `  (${row.detail})` : ''}`);
    }
    return;
  }

  if (action === 'preset') {
    const preset = args[1];
    if (!preset || preset === 'off') {
      await appendEnvValue('CARINA_LLM_PRESET', '');
      llm.setPreset(undefined);
      console.log('LLM preset cleared.');
      return;
    }
    if (preset !== FREE_COPILOT_PRESET) {
      console.error(`Unknown preset: ${preset}. Available: ${FREE_COPILOT_PRESET}`);
      process.exit(1);
    }
    const selection = llm.copilotSelection();
    if (!selection.primary) {
      console.error('Free Copilot is not available. Configure a local or low-cost provider first.');
      process.exit(1);
    }
    await appendEnvValue('CARINA_LLM_PRESET', preset);
    await appendEnvValue('DEFAULT_PROVIDER', selection.primary);
    llm.setPreset(preset);
    llm.use(selection.primary);
    console.log(chalk.green(`Preset active: ${preset} (primary: ${selection.primary})`));
    console.log(chalk.gray(selection.note));
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

  console.error('Usage: carina providers <list|info|copilot|preset|health|test> [args]');
  process.exit(1);
}

export async function maybeProbeProvidersOnStartup(): Promise<void> {
  if (process.env.CARINA_PROVIDER_HEALTH_PROBE !== 'true') return;
  const configured = PROVIDER_DEFINITIONS
    .filter((d) => d.local && isProviderConfigured(d))
    .map((d) => d.name);
  if (configured.length === 0) return;
  await probeConfiguredLocalProviders(configured);
}
