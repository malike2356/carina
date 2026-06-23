#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');

const vitest = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'src/security/governance/governance.test.ts'],
  { cwd: coreRoot, stdio: 'inherit', env: process.env },
);
process.exit(vitest.status ?? 1);
