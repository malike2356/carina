#!/usr/bin/env node
/**
 * Remove bundled domain pack sources from dist before npm publish.
 * Kernel tarball ships tools/memory/channels; packs install separately.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'dist', 'src', 'skills', 'packs');

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[prune-pack-dist] removed ${path.relative(root, target)}`);
}

for (const rel of ['src/gateway/web', 'public/dashboard']) {
  const p = path.join(root, 'dist', rel);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`[prune-pack-dist] removed ${path.relative(root, p)}`);
  }
}
