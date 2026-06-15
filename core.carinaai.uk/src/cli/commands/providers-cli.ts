import chalk from 'chalk';
import {
  PROVIDER_DEFINITIONS,
  disableProvider,
  enableProvider,
  isProviderConfigured,
  listDisabledProviders,
  listEmbeddingProviders,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  providerTransportType,
} from '../../brain/provider-registry.js';
import {
  buildProviderCapabilityReport,
  formatReasoningEffortLine,
  formatStreamingLine,
  streamingMatrixRows,
} from '../../brain/provider-capability-detection.js';
import { getCredentialPoolManager } from '../../credentials/index.js';
import {
  buildCatalogRows,
  formatCompactCatalogLine,
  formatProviderCatalogHeader,
} from '../../brain/provider-catalog.js';
import { describeProviderTags } from '../../brain/provider-tags.js';
import {
  listProviderHealth,
  probeConfiguredLocalProviders,
  probeProviderHealth,
  resetProviderHealth,
} from '../../brain/provider-health.js';
import { FREE_COPILOT_PRESET } from '../../brain/provider-routing.js';
import { llm } from '../../brain/llm.js';
import { loadLocalEnv } from '../config/env.js';
import { appendEnvValue } from '../config/loader.js';

export async function runProvidersCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'list';

  if (action === 'list') {
    console.log(chalk.bold('\nCarina provider catalog\n'));
    console.log(chalk.gray(formatProviderCatalogHeader()));
    for (const row of buildCatalogRows({ includeCatalogOnly: true })) {
      const line = formatCompactCatalogLine(row);
      const styled = row.status === 'active' || row.status === 'experimental'
        ? line
        : chalk.gray(line);
      const note = PROVIDER_DEFINITIONS.find((d) => d.name === row.id)?.setupNote;
      console.log(`  ${styled}${note ? chalk.gray(`\n      ${note}`) : ''}`);
    }

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
      console.error('Usage: carina providers info <name> [--json]');
      process.exit(1);
    }
    const def = PROVIDER_DEFINITIONS.find((d) => d.name === name);
    if (!def) {
      console.error(`Unknown provider: ${name}`);
      process.exit(1);
    }
    const jsonFlag = args.includes('--json');
    const modelOverride = args.find((a, i) => args[i - 1] === '--model');
    const report = buildProviderCapabilityReport(def, {
      model: modelOverride,
      configured: isProviderConfigured(def),
    });
    if (jsonFlag) {
      const pool = getCredentialPoolManager().describePool(def.name);
      console.log(JSON.stringify({ ...report, authProfile: { keysInPool: pool.size } }, null, 2));
      return;
    }
    console.log(`\n${def.displayName}`);
    console.log(`  name:       ${def.name}`);
    console.log(`  status:     ${def.status}`);
    console.log(`  auth:       ${def.authType}`);
    console.log(`  transport:  ${report.transport}`);
    console.log(`  cost:       ${def.tags.cost}`);
    if (def.status === 'active' || def.status === 'experimental' || def.embeddingOnly) {
      console.log(`  configured: ${report.configured}`);
      if (!def.capabilities.embeddings || def.capabilities.chat) {
        console.log(`  model:      ${report.model}`);
      }
      if (def.capabilities.embeddings) {
        console.log(`  embed model: ${providerModel(def)}`);
      }
      console.log(`  tags:       ${describeProviderTags(def)}`);
      console.log(`  key env:    ${def.apiKeyEnv}`);
      if (def.baseUrlEnv) console.log(`  base env:   ${def.baseUrlEnv}`);
      const pool = getCredentialPoolManager().describePool(def.name);
      if (pool.size > 0) {
        console.log(`  auth pool:  ${pool.size} key(s) in credential store`);
      }
    }
    if (def.aliasFor) console.log(`  alias for:  ${def.aliasFor}`);
    if (def.setupNote) console.log(`  setup:      ${def.setupNote}`);
    const caps = def.capabilities;
    console.log(`  streaming:  ${formatStreamingLine(report.streaming)}`);
    if (report.streaming.notes) console.log(`              ${report.streaming.notes}`);
    console.log(`  tools:      ${caps.tools ? 'yes' : 'no'}`);
    console.log(`  vision:     ${caps.vision ? 'yes' : 'no'}`);
    console.log(`  reasoning:  ${caps.reasoning ? 'yes' : 'no'}`);
    console.log(`  effort:     ${formatReasoningEffortLine(report.reasoningEffort)}`);
    if (caps.embeddings) console.log(`  embeddings: yes (RAG + memory path)`);
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

  if (action === 'disable') {
    const name = args[1];
    if (!name) {
      console.error('Usage: carina providers disable <name>');
      process.exit(1);
    }
    const def = PROVIDER_DEFINITIONS.find((d) => d.name === name);
    if (!def) {
      console.error(`Unknown provider: ${name}`);
      process.exit(1);
    }
    disableProvider(name);
    console.log(`Provider "${name}" disabled for this session.`);
    return;
  }

  if (action === 'enable') {
    const name = args[1];
    if (!name) {
      const disabled = listDisabledProviders();
      if (disabled.length === 0) {
        console.log('No providers are currently disabled.');
      } else {
        console.log('Disabled providers:', disabled.join(', '));
      }
      return;
    }
    enableProvider(name);
    console.log(`Provider "${name}" re-enabled.`);
    return;
  }

  if (action === 'plugins') {
    const { listProviderPluginFiles, getLoadedProviderPluginFiles, hasProviderFactory } = await import('../../plugins/loader.js');
    const files = listProviderPluginFiles();
    const loaded = getLoadedProviderPluginFiles();
    console.log(chalk.bold('\nProvider plugins (plugins/providers/)\n'));
    if (files.length === 0) {
      console.log('  No provider plugin files found.');
      console.log(chalk.gray('  Add .ts modules under plugins/providers/ (see plugins/providers/github-copilot.ts).'));
      return;
    }
    for (const file of files) {
      const active = loaded.includes(file);
      console.log(`  ${active ? chalk.green('loaded') : chalk.gray('pending')}  ${file}`);
    }
    const withFactory = PROVIDER_DEFINITIONS
      .filter((d) => hasProviderFactory(d.name))
      .map((d) => d.name);
    if (withFactory.length > 0) {
      console.log(chalk.gray(`\n  Custom factories: ${withFactory.join(', ')}`));
    }
    console.log('');
    return;
  }

  if (action === 'scan') {
    const targetName = args[1];
    const toScan = PROVIDER_DEFINITIONS.filter((d) => {
      if (targetName) return d.name === targetName;
      return isProviderConfigured(d) && (d.kind === 'openai' || d.local === true);
    });
    if (toScan.length === 0) {
      console.log(targetName
        ? `Provider "${targetName}" not found or not configured.`
        : 'No configured OpenAI-compatible providers to scan.');
      return;
    }
    console.log(chalk.bold('\nScanning providers for available models...\n'));
    for (const def of toScan) {
      const base = providerBaseUrl(def);
      if (!base) {
        console.log(`  ${chalk.bold(def.name)}: no base URL`);
        continue;
      }
      const url = `${base.replace(/\/$/, '')}/models`;
      const apiKey = providerApiKey(def);
      try {
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          console.log(`  ${chalk.bold(def.name)}: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json() as Record<string, unknown>;
        let models: string[] = [];
        const raw = data['data'] ?? data['models'] ?? data;
        if (Array.isArray(raw)) {
          models = (raw as Array<Record<string, string>>)
            .map((m) => m['id'] ?? m['name'] ?? '')
            .filter(Boolean);
        }
        console.log(`  ${chalk.bold(def.name)} - ${models.length} model(s)`);
        for (const m of models.slice(0, 12)) {
          console.log(`    ${m}`);
        }
        if (models.length > 12) {
          console.log(`    ... and ${models.length - 12} more`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ${chalk.bold(def.name)}: ${chalk.red(msg)}`);
      }
    }
    console.log('');
    return;
  }

  if (action === 'matrix') {
    const allFlag = args.includes('--all');
    const embedFlag = args.includes('--embeddings');
    const defs = allFlag
      ? PROVIDER_DEFINITIONS
      : embedFlag
        ? listEmbeddingProviders()
        : PROVIDER_DEFINITIONS.filter((d) => (d.status === 'active' || d.status === 'experimental') && !d.embeddingOnly);
    const yn = (v: boolean | undefined) => (v ? chalk.green('yes') : chalk.gray('no '));
    console.log(chalk.bold('\nStreaming compatibility matrix\n'));
    console.log(chalk.gray('  See docs/providers-streaming-matrix.md for transport notes.\n'));
    const hdr = `  ${'Provider'.padEnd(18)} ${'Transport'.padEnd(22)} stream  s+tool  tools   vision  reason  effort  status`;
    console.log(chalk.gray(hdr));
    for (const row of streamingMatrixRows(defs)) {
      const styledRow = `  ${row.name.padEnd(18)} ${row.transport.padEnd(22)} ${yn(row.stream)}    ${yn(row.streamTools)}    ${yn(row.tools)}    ${yn(row.vision)}    ${yn(row.reasoning)}    ${yn(row.reasoningEffort)}    ${row.status}`;
      const styled = row.status === 'active' ? styledRow : chalk.gray(styledRow);
      console.log(styled);
    }
    if (!allFlag && !embedFlag) {
      console.log(chalk.gray('\n  Pass --all for alias/oauth/cli entries; --embeddings for RAG backends'));
    }
    console.log('');
    return;
  }

  console.error('Usage: carina providers <list|info|plugins|copilot|preset|health|test|disable|enable|scan|matrix> [args]');
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
