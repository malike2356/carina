#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

const vitest = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'src/security/secrets/secrets-rotation.test.ts'],
  { cwd: coreRoot, stdio: 'inherit', env: process.env },
);
if (vitest.status !== 0) process.exit(vitest.status ?? 1);

const review = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'scripts/run-secrets-rotation.ts', ...args],
  { cwd: coreRoot, stdio: 'inherit', env: process.env },
);
process.exit(review.status ?? 1);
