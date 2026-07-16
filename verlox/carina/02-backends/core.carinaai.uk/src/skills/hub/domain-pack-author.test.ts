import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initDomainPackDirectory, validateDomainPackForPublish } from './domain-pack-author.js';

describe('domain-pack-author', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-pack-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scaffolds a valid third-party pack', async () => {
    const packDir = path.join(tmpDir, 'demo-pack');
    const scaffold = await initDomainPackDirectory({
      targetDir: packDir,
      name: 'demo-pack',
      author: 'Acme Corp',
      description: 'Demo domain pack for tests',
      category: 'demo',
    });
    expect(scaffold.files).toContain('pack.json');
    const validation = await validateDomainPackForPublish(scaffold.dir);
    expect(validation.ok).toBe(true);
  });
});
