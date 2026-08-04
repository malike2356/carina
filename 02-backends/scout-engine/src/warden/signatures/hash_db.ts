// Known-bad SHA256 database (SQLite optional; Map fallback)
import fs from 'node:fs';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';

const badHashes = new Set<string>();

export function loadHashDb(): number {
  const cfg = loadWardenConfig();
  const txt = path.join(cfg.signatures_dir, 'hash_blocklist.txt');
  if (!fs.existsSync(txt)) return 0;
  for (const line of fs.readFileSync(txt, 'utf8').split('\n')) {
    const h = line.trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(h)) badHashes.add(h);
  }
  return badHashes.size;
}

export function isKnownBadHash(sha256: string): boolean {
  if (badHashes.size === 0) loadHashDb();
  return badHashes.has(sha256.toLowerCase());
}

export function addBadHash(sha256: string): void {
  badHashes.add(sha256.toLowerCase());
}
