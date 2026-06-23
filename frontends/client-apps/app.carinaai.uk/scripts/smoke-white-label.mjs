#!/usr/bin/env node
/**
 * App-local white-label smoke entry point for CI or pre-deploy checks.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const coreRoot = path.resolve(appRoot, '../../../backends/servers/core.carinaai.uk');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('node', [path.join(coreRoot, 'scripts/white-label-copy-guard.mjs')], appRoot);
run('pnpm', ['exec', 'vitest', 'run', 'src/lib/white-label-smoke.test.ts'], appRoot);

console.log('App white-label smoke OK.');
