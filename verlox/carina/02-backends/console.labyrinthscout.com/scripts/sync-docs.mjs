#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOCS_SRC = path.join(ROOT, 'docs');
const DIST = path.join(DOCS_SRC, '.vitepress', 'dist');
const PUBLIC_DOCS = path.join(ROOT, 'public', 'docs');

function mirrorCleanUrls(docsDir) {
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith('.html') || name === '404.html') continue;

      const rel = path.relative(docsDir, full);
      const base = path.basename(rel, '.html');
      if (base === 'index') continue;

      const parent = path.dirname(rel);
      const targetDir = path.join(docsDir, parent, base);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(full, path.join(targetDir, 'index.html'));
    }
  }

  walk(docsDir);
}

if (!fs.existsSync(DOCS_SRC)) {
  console.warn(`Docs source not found (${DOCS_SRC}); skipping public/docs sync`);
  process.exit(0);
}

execSync('pnpm docs:build', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VP_BASE: '/docs/' },
});

if (!fs.existsSync(DIST)) {
  console.error(`VitePress build output missing: ${DIST}`);
  process.exit(1);
}

fs.rmSync(PUBLIC_DOCS, { recursive: true, force: true });
fs.cpSync(DIST, PUBLIC_DOCS, { recursive: true });
mirrorCleanUrls(PUBLIC_DOCS);

console.log(`Synced Scout docs to public/docs/`);
