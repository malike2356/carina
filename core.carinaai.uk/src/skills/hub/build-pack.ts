import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildPropertyUkArchive(outputDir: string): Promise<string> {
  const brainRoot = path.resolve(
    __dirname,
    '../../../brain/uk_property_knowldge_from_propreneur/masterbrain',
  );
  const tmpDir = path.join(outputDir, '.build-property-uk');
  const knowledgeDir = path.join(tmpDir, 'knowledge');
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(knowledgeDir, { recursive: true });

  await copyMdTree(brainRoot, knowledgeDir);
  await fs.writeFile(
    path.join(tmpDir, 'pack.json'),
    JSON.stringify(
      {
        name: 'property-uk',
        version: '1.0.0',
        description: 'UK property entrepreneurship knowledge pack',
        author: 'VERLOX Ltd',
        skillCount: 6,
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
