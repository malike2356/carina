#!/usr/bin/env node
/**
 * CI entry point for Real Behavior Proof checks.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', 'src/security/behavior-proof.test.ts'],
  { cwd: coreRoot, stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
