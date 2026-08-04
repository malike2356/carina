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
    if (failed > 0) process.exit(1);
    return;
  }

  if (action === 'migrate') {
    const added = await migrateConfig();
    if (added.length === 0) {
      console.log('Config is up to date.');
      return;
    }
    console.log(`Added missing keys: ${added.join(', ')}`);
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

  console.error('Usage: carina config <list|show|get|set|unset|edit|check|migrate>');
  process.exit(1);
}
