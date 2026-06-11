import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  activateProfile,
  cloneProfile,
  createProfile,
  describeProfile,
  exportProfile,
  getActiveProfileName,
  importProfile,
  listProfiles,
} from './manager.js';

let tmpRoot: string;
let tmpGlobal: string;
const originalProfilesDir = process.env.CARINA_PROFILES_DIR;
const originalGlobalHome = process.env.CARINA_GLOBAL_HOME;

async function setup(): Promise<void> {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-profiles-'));
  tmpGlobal = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-global-'));
  process.env.CARINA_PROFILES_DIR = tmpRoot;
  process.env.CARINA_GLOBAL_HOME = tmpGlobal;
}

afterEach(async () => {
  process.env.CARINA_PROFILES_DIR = originalProfilesDir;
  process.env.CARINA_GLOBAL_HOME = originalGlobalHome;
  delete process.env.CARINA_HOME;
  delete process.env.CARINA_CREDENTIALS_FILE;
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
  if (tmpGlobal) await fs.rm(tmpGlobal, { recursive: true, force: true });
});

describe('profiles', () => {
  it('creates and lists profiles', async () => {
    await setup();
    const profile = await createProfile('work');
    expect(profile.name).toBe('work');
    expect(describeProfile('work').dir).toBe(profile.dir);

    const profiles = await listProfiles();
    expect(profiles).toContain('work');
  });

  it('persists active profile in global home, not profile dir', async () => {
    await setup();
    await createProfile('alpha');
    activateProfile('alpha');

    process.env.CARINA_HOME = '/tmp/some-other-home';
    expect(getActiveProfileName()).toBe('alpha');

    const activeFile = path.join(tmpGlobal, 'active-profile');
    const raw = await fs.readFile(activeFile, 'utf8');
    expect(raw.trim()).toBe('alpha');
  });

  it('clones a profile', async () => {
    await setup();
    await createProfile('source');
    const cloned = await cloneProfile('source', 'copy');
    expect(cloned.name).toBe('copy');
    expect((await listProfiles())).toContain('copy');

    const srcConfig = await fs.readFile(describeProfile('source').configPath, 'utf8');
    const dstConfig = await fs.readFile(cloned.configPath, 'utf8');
    expect(dstConfig).toBe(srcConfig);
  });

  it('exports and imports a profile', async () => {
    await setup();
    await createProfile('export-me');
    const exportDest = path.join(tmpRoot, 'export-bundle');
    await exportProfile('export-me', exportDest);

    const imported = await importProfile(exportDest, 'imported');
    expect(imported.name).toBe('imported');
    expect((await listProfiles())).toContain('imported');
  });
});
