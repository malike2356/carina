import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createProfile, activateProfile } from './manager.js';
import { bindProfileEnvironment, describeNamedProfileScope } from './scope.js';

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
  delete process.env.CARINA_TOOLSETS_FILE;
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
  if (tmpGlobal) await fs.rm(tmpGlobal, { recursive: true, force: true });
});

describe('profile scope', () => {
  it('binds credentials and toolsets to profile dir', async () => {
    await setup();
    const profile = await createProfile('scoped');
    bindProfileEnvironment(profile);

    expect(process.env.CARINA_HOME).toBe(profile.dir);
    expect(process.env.CARINA_CREDENTIALS_FILE).toBe(path.join(profile.dir, 'credentials.json'));
    expect(process.env.CARINA_TOOLSETS_FILE).toBe(path.join(profile.dir, 'toolsets.yaml'));
    expect(process.env.CARINA_EXTENSIONS_DIR).toBe(path.join(profile.dir, 'extensions'));
  });

  it('describes scoped vs global paths', async () => {
    await setup();
    const profile = await createProfile('scope-view');
    activateProfile('scope-view');
    const scope = describeNamedProfileScope('scope-view', 'scope-view');

    expect(scope.active).toBe(true);
    expect(scope.scoped.checkpoints).toBe(path.join(profile.dir, 'data', 'checkpoints'));
    expect(scope.global.activeProfileFile).toBe(path.join(tmpGlobal, 'active-profile'));
  });
});
