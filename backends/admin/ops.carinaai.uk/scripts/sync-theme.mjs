#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const THEME_SRC = path.join(ROOT, '..', '..', '..', 'themes', 'ops.carinaai.uk');
const THEME_DST = path.join(ROOT, 'public', 'theme');

const FILES = [
  'ops.carinaai.css',
  'ops-vars.css',
  'ops-chrome.css',
  'ops-base.css',
  'index.css',
];

if (!fs.existsSync(THEME_SRC)) {
  const fallback = path.join(THEME_DST, 'ops.carinaai.css');
  if (fs.existsSync(fallback)) {
    console.warn(`Theme source not found (${THEME_SRC}); using existing public/theme/`);
    process.exit(0);
  }
  console.error(`Theme source not found: ${THEME_SRC}`);
  process.exit(1);
}

fs.mkdirSync(THEME_DST, { recursive: true });
for (const file of FILES) {
  const src = path.join(THEME_SRC, file);
  if (!fs.existsSync(src)) {
    console.error(`Missing theme file: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(THEME_DST, file));
}

console.log(`Synced ${FILES.length} theme files to public/theme/`);
