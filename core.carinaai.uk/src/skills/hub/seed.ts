import fs from 'fs/promises';
import path from 'path';
import { listKnownPackNames } from '../pack-manifests.js';
import { resolvePack } from '../pack-resolver.js';
import { buildPackArchive, buildPropertyUkArchive } from './build-pack.js';
import { replacePackSkills, upsertHubPack } from './registry.js';

const FEATURED_PACKS = new Set(['property-uk', 'core-engineering']);

export async function seedHubRegistry(storageDir: string): Promise<{ packs: number; skills: number }> {
  await fs.mkdir(storageDir, { recursive: true });
  let skillTotal = 0;

  for (const name of listKnownPackNames()) {
    try {
      const pack = await resolvePack(name);
      const { manifest, skills } = pack;
      if (process.env.CARINA_EVAL_GATE === 'require') {
        const { runPackEvalGate } = await import('../eval/gate.js');
        const gate = await runPackEvalGate(manifest.name, { mode: 'require' });
        if (gate.blocked) {
          console.warn(`Hub seed skipped ${manifest.name}: ${gate.message}`);
          continue;
        }
      }
      const archivePath = await ensurePackArchive(manifest.name, storageDir);
      await upsertHubPack(manifest, archivePath, FEATURED_PACKS.has(manifest.name));
      await replacePackSkills(manifest.name, skills);
      skillTotal += skills.length;
    } catch (err) {
      console.warn(`Hub seed skipped ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { packs: listKnownPackNames().length, skills: skillTotal };
}

async function ensurePackArchive(packName: string, storageDir: string): Promise<string> {
  const archivePath = path.join(storageDir, `${packName}.tar.gz`);
  try {
    await fs.access(archivePath);
    return archivePath;
  } catch {
    if (packName === 'property-uk') {
      return buildPropertyUkArchive(storageDir);
    }
    return buildPackArchive(packName, storageDir);
  }
}
