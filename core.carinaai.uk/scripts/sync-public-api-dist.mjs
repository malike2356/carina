#!/usr/bin/env node
/**
 * Publish entrypoints live at dist/public-api/*.js (package.json exports).
 * Compiled modules stay at dist/src/public-api/ so relative imports resolve.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'dist', 'public-api');
const modules = ['index', 'pack', 'tool', 'channel', 'memory', 'provider'];

mkdirSync(outDir, { recursive: true });

for (const name of modules) {
  writeFileSync(
    path.join(outDir, `${name}.js`),
    `export * from '../src/public-api/${name}.js';\n`,
  );
}
