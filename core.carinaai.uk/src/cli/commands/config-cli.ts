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

  console.error('Usage: carina config <list|show|get|set|unset|edit|check|validate|migrate>');
  process.exit(1);
}
