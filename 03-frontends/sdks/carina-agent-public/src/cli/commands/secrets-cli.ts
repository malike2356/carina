import fs from 'fs';
import { CARINA_ENV_PATH } from '../../config/paths.js';
import { appendEnvValue } from '../config/loader.js';

function redact(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function runSecretsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';

  if (action === 'list') {
    if (!fs.existsSync(CARINA_ENV_PATH)) {
      console.log('No .env file.');
      return;
    }
    const lines = fs.readFileSync(CARINA_ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const key = line.slice(0, idx);
      const value = line.slice(idx + 1);
      const isSecret = /(_API_KEY|_TOKEN|_SECRET|PASSWORD)/i.test(key);
      console.log(`  ${key}=${isSecret ? redact(value) : value}`);
    }
    return;
  }

  if (action === 'set') {
    const key = args[1];
    const value = args.slice(2).join(' ');
    if (!key || !value) {
      console.error('Usage: carina secrets set <KEY> <value>');
      process.exit(1);
    }
    await appendEnvValue(key, value);
    console.log(`Set ${key} in .env`);
    return;
  }

  if (action === 'reload') {
    const { reloadSecrets } = await import('../../ops/secrets-reload.js');
    const notify = args.includes('--notify');
    const result = await reloadSecrets({ overwrite: true, notifyGateway: notify });
    console.log(`Reloaded ${result.reloaded.length} env key(s)`);
    if (notify) {
      console.log(result.gatewayNotified ? 'Gateway notified' : 'Gateway not reachable');
    }
    return;
  }

  console.error('Usage: carina secrets <list|set|reload> [KEY] [value]');
  process.exit(1);
}
