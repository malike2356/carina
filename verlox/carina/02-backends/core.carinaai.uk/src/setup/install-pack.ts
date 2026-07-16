import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config/index.js';
import { packDir } from '../config/paths.js';
import { ingestPackDirectory } from '../skills/ingestion.js';
import { loadPackSkills } from '../skills/index.js';

const execAsync = promisify(exec);

async function downloadPack(name: string, dest: string): Promise<void> {
  const url = `${config.hub.url}/packs/${name}/download`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Hub download failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const archive = path.join(dest, `${name}.tar.gz`);
  await fs.mkdir(dest, { recursive: true });
  await fs.writeFile(archive, buf);
  await execAsync(`tar -xzf "${archive}" -C "${dest}"`);
  await fs.unlink(archive);
}

async function copyLocalBrainPack(name: string, dest: string): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const brainRoot = path.resolve(
    here,
    '../../brain/uk_property_knowldge_from_propreneur/masterbrain',
  );
  const knowledgeDir = path.join(dest, 'knowledge');
  await fs.mkdir(knowledgeDir, { recursive: true });

  async function copyMd(src: string, rel: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(src, e.name);
      const outRel = path.join(rel, e.name);
      if (e.isDirectory()) {
        await copyMd(full, outRel);
      } else if (e.name.endsWith('.md')) {
        const outPath = path.join(knowledgeDir, outRel);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.copyFile(full, outPath);
      }
    }
  }

  await copyMd(brainRoot, '');
  const packJson = {
    name,
    version: '1.0.0',
    description: 'UK property entrepreneurship knowledge pack',
    author: 'VERLOX Ltd',
    skillCount: 6,
  };
  await fs.writeFile(path.join(dest, 'pack.json'), JSON.stringify(packJson, null, 2));
}

export async function installPack(name: string): Promise<void> {
  const dest = packDir(name);
  await fs.mkdir(dest, { recursive: true });

  try {
    await downloadPack(name, dest);
  } catch {
    console.log('Skills Hub unavailable; using local brain knowledge...');
    await fs.rm(dest, { recursive: true, force: true });
    await fs.mkdir(dest, { recursive: true });
    await copyLocalBrainPack(name, dest);
  }

  const skillsLoaded = await loadPackSkills(name);
  const chunks = await ingestPackDirectory(name, path.join(dest, 'knowledge'));
  console.log(
    `${name} installed. ${chunks} knowledge chunks ingested, ${skillsLoaded} skills loaded.`,
  );
}
