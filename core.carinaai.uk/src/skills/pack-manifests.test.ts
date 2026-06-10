import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { readPackManifest } from './pack-loader.js';

const PACKS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'packs');

const NEWLY_PUBLISHED = [
  'data-science',
  'devops',
  'email-extended',
  'media-extended',
  'mlops',
  'smart-home',
  'social-extended',
  'legal-uk',
  'sales-crm',
];

describe('pack manifests', () => {
  it('loads pack.json for all newly published packs', async () => {
    for (const name of NEWLY_PUBLISHED) {
      const manifest = await readPackManifest(path.join(PACKS_DIR, name));
      expect(manifest.name).toBe(name);
      expect(manifest.skillCount).toBeGreaterThan(0);
    }
  });

  it('has pack.json in every pack directory with skills.ts', async () => {
    const entries = await fs.readdir(PACKS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    for (const dir of dirs) {
      const skillsPath = path.join(PACKS_DIR, dir, 'skills.ts');
      try {
        await fs.access(skillsPath);
      } catch {
        continue;
      }
      const manifestPath = path.join(PACKS_DIR, dir, 'pack.json');
      await expect(fs.access(manifestPath)).resolves.toBeUndefined();
    }
  });
});
