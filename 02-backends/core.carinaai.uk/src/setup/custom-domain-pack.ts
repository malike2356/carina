import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { initDb } from '../memory/db.js';
import { ingestPackDirectory } from '../skills/ingestion.js';
import { importPack } from '../skills/index.js';

function packNameFromSource(source: string): string {
  const clean = source.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const base = path.basename(clean).replace(/\.tar\.gz$/i, '').replace(/\.tgz$/i, '');
  return base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-domain';
}

async function downloadArchive(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Domain pack download failed (${res.status}): ${url}`);
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-domain-pack-'));
  const archive = path.join(tmpDir, packNameFromSource(url) + '.tar.gz');
  await fs.writeFile(archive, Buffer.from(await res.arrayBuffer()));
  return archive;
}

export async function installCustomDomainPack(source: string): Promise<string | null> {
  const trimmed = source.trim();
  if (!trimmed || trimmed.toLowerCase() === 'skip') return null;

  const packName = packNameFromSource(trimmed);
  await initDb();

  if (/^https?:\/\//i.test(trimmed)) {
    const archive = await downloadArchive(trimmed);
    try {
      await importPack(archive);
    } finally {
      await fs.rm(path.dirname(archive), { recursive: true, force: true });
    }
    return packName;
  }

  const resolved = path.resolve(trimmed);
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) {
    const knowledgeDir = path.join(resolved, 'knowledge');
    const ingestDir = await fs.stat(knowledgeDir).then((s) => s.isDirectory() ? knowledgeDir : resolved).catch(() => resolved);
    const chunks = await ingestPackDirectory(packName, ingestDir);
    console.log(`${packName} installed. ${chunks} knowledge chunks ingested.`);
    return packName;
  }

  await importPack(resolved);
  return packName;
}
