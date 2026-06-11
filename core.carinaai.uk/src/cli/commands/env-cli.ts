import fs from 'fs';
import { CARINA_ENV_PATH, CARINA_HOME } from '../../config/paths.js';
import { loadLocalEnv } from '../config/env.js';

const PUBLIC_KEYS = [
  'DEFAULT_PROVIDER', 'DEFAULT_MODEL', 'WEB_PORT', 'WEB_ENABLED',
  'LABYRINTH_ENABLED', 'SCOUT_ENABLED', 'CARINA_LOCAL_MODE', 'CARINA_HOME',
  'REDIS_URL', 'DATABASE_URL',
];

export async function runEnvCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'show';

  if (action === 'show') {
    console.log(`CARINA_HOME=${CARINA_HOME}`);
    for (const key of PUBLIC_KEYS) {
      if (process.env[key]) console.log(`${key}=${process.env[key]}`);
    }
    if (fs.existsSync(CARINA_ENV_PATH)) {
      const lines = fs.readFileSync(CARINA_ENV_PATH, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) continue;
        const key = line.split('=')[0];
        if (/(_API_KEY|_TOKEN|_SECRET|PASSWORD)/i.test(key)) {
          console.log(`${key}=<set>`);
        }
      }
    }
    return;
  }

  console.error('Usage: carina env show');
  process.exit(1);
}
