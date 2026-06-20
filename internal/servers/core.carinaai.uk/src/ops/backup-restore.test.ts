import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, planRestore, restoreBackupWithOptions, verifyBackup } from './backup-restore.js';

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
  });

  it('restores files into home', async () => {
    const home = await makeHome();
    await createBackup({ homeDir: home, label: 'restore-me', includePostgres: false });
    await fs.rm(path.join(home, 'config.yaml'));
    const result = await restoreBackupWithOptions('restore-me', { force: true, homeDir: home });
    expect(result.restored).toContain('config.yaml');
    const content = await fs.readFile(path.join(home, 'config.yaml'), 'utf-8');
    expect(content).toContain('agent: test');
  });

  it('planRestore lists overwrite targets and warnings', async () => {
    const home = await makeHome();
    await createBackup({ homeDir: home, label: 'plan-me', includePostgres: false, items: ['config.yaml'] });
    const plan = await planRestore('plan-me', home);
    expect(plan.items).toContain('config.yaml');
    expect(plan.willOverwrite).toContain('config.yaml');
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('restore requires force when overwriting', async () => {
    const home = await makeHome();
    await createBackup({ homeDir: home, label: 'force-me', includePostgres: false, items: ['config.yaml'] });
    await expect(restoreBackupWithOptions('force-me', { homeDir: home })).rejects.toThrow(/overwrite/);
  });

  it('dry-run restore does not modify home', async () => {
    const home = await makeHome();
    await createBackup({ homeDir: home, label: 'dry-me', includePostgres: false, items: ['config.yaml'] });
    await fs.rm(path.join(home, 'config.yaml'));
    const result = await restoreBackupWithOptions('dry-me', { dryRun: true, homeDir: home });
    expect(result.dryRun).toBe(true);
    await expect(fs.access(path.join(home, 'config.yaml'))).rejects.toThrow();
  });

  it('creates manifest with secrets summary key names only', async () => {
    const home = await makeHome();
    await fs.writeFile(path.join(home, '.env'), 'ANTHROPIC_API_KEY=secret\nWEB_PORT=3000\n');
    const { manifest } = await createBackup({
      homeDir: home,
      label: 'secrets-backup',
      includePostgres: false,
      items: ['config.yaml', '.env'],
    });
    expect(manifest.sensitiveItems).toContain('.env');
    expect(manifest.secretsSummaryPath).toBe('secrets-summary.json');
    const summary = JSON.parse(
      await fs.readFile(path.join(home, 'backups', 'secrets-backup', 'secrets-summary.json'), 'utf-8'),
    );
    expect(summary.keys).toContain('ANTHROPIC_API_KEY');
    expect(summary.keys).not.toContain('secret');
    expect(JSON.stringify(summary.keys)).not.toContain('sk-');
  });
});
