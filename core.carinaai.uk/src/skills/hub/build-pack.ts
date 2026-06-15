import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BUILTIN_PACKS_DIR } from '../pack-loader.js';
import { resolvePackDirectory } from '../pack-discovery.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveBrainRoot(): string {
  const BRAIN_REL = 'brain/uk_property_knowldge_from_propreneur/masterbrain';
  for (let ups = 3; ups <= 5; ups++) {
    const candidate = path.resolve(__dirname, '../'.repeat(ups) + BRAIN_REL);
    if (fsSync.existsSync(candidate)) return candidate;
  }
  throw new Error(`Brain corpus not found (searched from ${__dirname})`);
}

export async function buildPackArchive(packName: string, outputDir: string): Promise<string> {
  const packRoot = resolvePackDirectory(packName) ?? path.join(BUILTIN_PACKS_DIR, packName);
  await fs.access(packRoot);
  const archivePath = path.join(outputDir, `${packName}.tar.gz`);
  await fs.mkdir(outputDir, { recursive: true });
  await execAsync(`tar -czf "${archivePath}" -C "${packRoot}" .`);
  return archivePath;
}

export async function buildPropertyUkArchive(outputDir: string): Promise<string> {
  const brainRoot = resolveBrainRoot();
  const tmpDir = path.join(outputDir, '.build-property-uk');
  const knowledgeDir = path.join(tmpDir, 'knowledge');
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(knowledgeDir, { recursive: true });

  await copyMdTree(brainRoot, knowledgeDir);
  const packRoot = resolvePackDirectory('property-uk')
    ?? path.join(BUILTIN_PACKS_DIR, 'property-uk');
  await copyPackFilesExceptKnowledge(packRoot, tmpDir);

  await fs.writeFile(
    path.join(tmpDir, 'pack.json'),
    JSON.stringify(
      {
        name: 'property-uk',
        version: '1.0.0',
        description: 'UK property entrepreneurship knowledge pack',
        author: 'VERLOX Ltd',
        skillCount: 6,
        category: 'property',
      },
      null,
      2,
    ),
  );

  const archivePath = path.join(outputDir, 'property-uk.tar.gz');
  await execAsync(`tar -czf "${archivePath}" -C "${tmpDir}" .`);
  await fs.rm(tmpDir, { recursive: true, force: true });
  return archivePath;
}

async function copyPackFilesExceptKnowledge(packRoot: string, dest: string): Promise<void> {
  const entries = await fs.readdir(packRoot, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'knowledge') continue;
    const src = path.join(packRoot, e.name);
    const out = path.join(dest, e.name);
    if (e.isDirectory()) {
      await execAsync(`cp -r "${src}" "${out}"`);
    } else {
      await fs.copyFile(src, out);
    }
  }
}

async function copyMdTree(src: string, destRoot: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    if (e.isDirectory()) {
      await copyMdTree(srcPath, destRoot);
    } else if (e.name.endsWith('.md')) {
      const rel = path.relative(
        path.resolve(__dirname, '../../../brain/uk_property_knowldge_from_propreneur/masterbrain'),
        srcPath,
      );
      const out = path.join(destRoot, rel);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.copyFile(srcPath, out);
    }
  }
}
