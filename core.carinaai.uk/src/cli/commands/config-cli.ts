import YAML from 'yaml';
import {
  checkConfig,
  getConfigValue,
  loadFromYaml,
  migrateConfig,
  openConfigInEditor,
  setConfigOrSecret,
  setConfigValue,
} from '../config/loader.js';
import {
  deleteAuxiliaryConfig,
  getAuxiliaryModels,
  saveAuxiliaryConfig,
} from '../config/auxiliary-models.js';
import { AUXILIARY_TASK_NAMES, isAuxiliaryTaskName } from '../../types/auxiliary-model.js';
import {
  formatRuntimeConfigSummary,
  migrateRuntimeConfig,
  validateRuntimeConfig,
} from '../../config/runtime-config.js';

export async function runConfigCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const keyPath = args[1];
  const value = args.slice(2).join(' ');

  if (action === 'list' || action === 'show') {
    console.log(YAML.stringify(await loadFromYaml()));
    return;
  }

  if (action === 'get') {
    if (!keyPath) {
      console.error('Usage: carina config get <path>');
      process.exit(1);
    }
    const result = await getConfigValue(keyPath);
    if (typeof result === 'object') console.log(YAML.stringify(result));
    else console.log(result ?? '');
    return;
  }

  if (action === 'set') {
    if (!keyPath || !value) {
      console.error('Usage: carina config set <path> <value>');
      process.exit(1);
    }
    const target = await setConfigOrSecret(keyPath, value);
    console.log(`Updated ${keyPath} (${target === 'env' ? '.env' : 'config.yaml'})`);
    return;
  }

  if (action === 'edit') {
    const { CLI_CONFIG_PATH } = await import('../config/loader.js');
    await openConfigInEditor(CLI_CONFIG_PATH);
    return;
  }

  if (action === 'check') {
    const results = await checkConfig();
    let failed = 0;
    for (const r of results) {
      console.log(`  ${r.ok ? 'ok' : 'FAIL'}  ${r.key}: ${r.detail}`);
      if (!r.ok) failed++;
    }
    const runtimeIssues = validateRuntimeConfig();
    for (const issue of runtimeIssues) {
      console.log(`  FAIL  runtime.${issue.path}: ${issue.message}`);
      failed++;
    }
    if (runtimeIssues.length === 0) {
      console.log('  ok  runtime.yaml: valid');
    }
    console.log('');
    console.log(formatRuntimeConfigSummary());
    if (failed > 0) process.exit(1);
    return;
  }

  if (action === 'validate') {
    const runtimeIssues = validateRuntimeConfig();
    const cliResults = await checkConfig();
    let failed = runtimeIssues.length;
    for (const r of cliResults) {
      if (!r.ok) failed++;
    }
    if (failed === 0) {
      console.log('Config validation passed.');
      console.log(formatRuntimeConfigSummary());
      return;
    }
    for (const issue of runtimeIssues) {
      console.log(`FAIL runtime.${issue.path}: ${issue.message}`);
    }
    for (const r of cliResults) {
      if (!r.ok) console.log(`FAIL ${r.key}: ${r.detail}`);
    }
    process.exit(1);
    return;
  }

  if (action === 'migrate') {
    const added = await migrateConfig();
    const runtimeAdded = migrateRuntimeConfig();
    if (added.length === 0 && runtimeAdded.length === 0) {
      console.log('Config is up to date.');
      return;
    }
    if (added.length > 0) console.log(`config.yaml added: ${added.join(', ')}`);
    if (runtimeAdded.length > 0) console.log(`runtime.yaml added: ${runtimeAdded.join(', ')}`);
    return;
  }

  if (action === 'unset') {
    if (!keyPath) {
      console.error('Usage: carina config unset <path>');
      process.exit(1);
    }
    await setConfigValue(keyPath, '');
    console.log(`Cleared ${keyPath}`);
    return;
  }

  if (action === 'set-task-model') {
    const task = args[1];
    const model = args[2];
    if (!task || !model) {
      console.error('Usage: carina config set-task-model <task> <model|reset> [--provider <name>] [--max-tokens <n>]');
      process.exit(1);
    }
    if (!isAuxiliaryTaskName(task)) {
      console.error(`Unknown task: ${task}. Choices: ${AUXILIARY_TASK_NAMES.join(', ')}`);
      process.exit(1);
    }
    if (model === 'reset') {
      await deleteAuxiliaryConfig(task);
      console.log(`Auxiliary model for ${task} reset to primary model`);
      return;
    }
    const providerIdx = args.indexOf('--provider');
    const maxTokensIdx = args.indexOf('--max-tokens');
    const provider = providerIdx >= 0 ? args[providerIdx + 1] : undefined;
    const maxTokensRaw = maxTokensIdx >= 0 ? args[maxTokensIdx + 1] : undefined;
    const maxTokens = maxTokensRaw ? Number.parseInt(maxTokensRaw, 10) : undefined;
    await saveAuxiliaryConfig(task, {
      model,
      ...(provider ? { provider } : {}),
      ...(Number.isFinite(maxTokens) && maxTokens! > 0 ? { maxTokens } : {}),
    });
    const label = provider ? `${provider}/${model}` : model;
    console.log(`Auxiliary model for ${task} set to ${label}`);
    return;
  }

  if (action === 'list-task-models') {
    const map = await getAuxiliaryModels();
    const rows = Object.entries(map).map(([task, cfg]) => {
      const provider = cfg.provider ?? 'primary';
      const model = cfg.model ?? 'primary';
      const extras = [
        cfg.maxTokens ? `maxTokens=${cfg.maxTokens}` : null,
        cfg.temperature !== undefined ? `temperature=${cfg.temperature}` : null,
      ].filter(Boolean).join(' ');
      return `${task.padEnd(18)} ${provider}/${model}${extras ? ` (${extras})` : ''}`;
    });
    if (rows.length === 0) {
      console.log('No auxiliary overrides set (all tasks use primary model)');
      return;
    }
    console.log(rows.join('\n'));
    return;
  }

  console.error('Usage: carina config <list|show|get|set|unset|edit|check|validate|migrate|set-task-model|list-task-models>');
  process.exit(1);
}
