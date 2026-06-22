import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveCarinaCliCommand } from './pty-bridge-core.js';

const execFileAsync = promisify(execFile);

export type Soc2SyncResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  controlsTouched: string[];
  errors: string[];
  raw?: string;
};

export async function syncSoc2Evidence(options: { refresh?: boolean } = {}): Promise<Soc2SyncResult> {
  const args = ['compliance', 'sync-scout', '--framework', 'soc2', '--json'];
  if (options.refresh) args.push('--refresh');

  const { file, args: spawnArgs, cwd } = resolveCarinaCliCommand(args);
  const { stdout } = await execFileAsync(file, spawnArgs, {
    timeout: 120_000,
    env: {
      ...process.env,
      DOTENV_CONFIG_QUIET: 'true',
      DATABASE_URL: process.env.CARINA_DB_URL ?? process.env.DATABASE_URL,
      SCOUT_DATABASE_URL: process.env.SCOUT_COMPLIANCE_DB_URL
        ?? process.env.SCOUT_DATABASE_URL
        ?? 'postgresql://scout:scout@scout-postgres:5432/scout',
    },
    cwd,
    maxBuffer: 4 * 1024 * 1024,
  });

  const jsonStart = stdout.indexOf('{');
  const jsonEnd = stdout.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Carina compliance sync-scout did not return JSON');
  }

  const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as Soc2SyncResult;
  return { ...parsed, raw: stdout };
}
