import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, listBackups, restoreBackup, verifyBackup } from './backup-restore.js';

const tmpRoots: string[] = [];

async function makeHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-ops-backup-'));
  tmpRoots.push(dir);
  await fs.writeFile(path.join(dir, 'config.yaml'), 'agent: test\n');
  await fs.mkdir(path.join(dir, 'sessions'), { recursive: true });
  await fs.writeFile(path.join(dir, 'sessions', 'a.json'), '{"id":"a"}');
  return dir;
}

afterEach(async () => {
  for (const dir of tmpRoots.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('backup-restore', () => {
  it('creates manifest and verifies checksums', async () => {
    const home = await makeHome();
    const { label, manifest } = await createBackup({
      homeDir: home,
      label: 'test-backup',
      includePostgres: false,
      items: ['config.yaml', 'sessions'],
    });
    expect(label).toBe('test-backup');
    expect(manifest.files.length).toBeGreaterThan(0);
    const verify = await verifyBackup(label, home);
    expect(verify.ok).toBe(true);
    const listed = await listBackups(home);
    expect(listed).toContain('test-backup');
  });

  it('restores files into home', async () => {
    const home = await makeHome();
    await createBackup({ homeDir: home, label: 'restore-me', includePostgres: false });
    await fs.rm(path.join(home, 'config.yaml'));
    const result = await restoreBackup('restore-me', home);
    expect(result.restored).toContain('config.yaml');
    const content = await fs.readFile(path.join(home, 'config.yaml'), 'utf-8');
    expect(content).toContain('agent: test');
  });
});
