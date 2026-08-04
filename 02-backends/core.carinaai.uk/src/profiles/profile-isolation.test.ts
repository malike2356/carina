import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createProfile, getActiveProfileName } from './manager.js';
import { bindProfileEnvironment } from './scope.js';
import {
  getActiveProfileOrDefault,
  operatorMemoryScope,
  peekPreviousProfile,
  switchProfile,
  switchProfileBack,
  wrapSessionForProfile,
} from './isolation.js';

let tmpRoot: string;
let tmpGlobal: string;
const originalProfilesDir = process.env.CARINA_PROFILES_DIR;
const originalGlobalHome = process.env.CARINA_GLOBAL_HOME;

async function setup(): Promise<void> {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-iso-'));
  tmpGlobal = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-iso-global-'));
  process.env.CARINA_PROFILES_DIR = tmpRoot;
  process.env.CARINA_GLOBAL_HOME = tmpGlobal;
}

afterEach(async () => {
  process.env.CARINA_PROFILES_DIR = originalProfilesDir;
  process.env.CARINA_GLOBAL_HOME = originalGlobalHome;
  delete process.env.CARINA_HOME;
  delete process.env.CARINA_PROFILE;
  delete process.env.CARINA_EXTENSIONS_DIR;
  delete process.env.CARINA_OPERATOR_SESSION_SCOPE;
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
  if (tmpGlobal) await fs.rm(tmpGlobal, { recursive: true, force: true });
});

describe('profile isolation', () => {
  it('binds full path env per profile', async () => {
    await setup();
    const profile = await createProfile('work');
    bindProfileEnvironment(profile);

    expect(process.env.CARINA_HOME).toBe(profile.dir);
    expect(process.env.CARINA_EXTENSIONS_DIR).toBe(path.join(profile.dir, 'extensions'));
    expect(process.env.CARINA_OPERATOR_SESSION_SCOPE).toBe('op:work');
    expect(process.env.CARINA_PROFILE_SESSION_PREFIX).toBe('profile:work:');
  });

  it('scopes operator memory away from other profiles', () => {
    const work = operatorMemoryScope('work');
    expect(work.sql).toContain('session_id LIKE $1');
    expect(work.params[0]).toBe('profile:work:%');
    expect(work.params[1]).toBe('op:work');

    const alpha = operatorMemoryScope('alpha');
    expect(alpha.sql).not.toContain("session_id NOT LIKE 'profile:%'");
  });

  it('default profile retains legacy unprefixed sessions', () => {
    const scope = operatorMemoryScope('default');
    expect(scope.sql).toContain("session_id NOT LIKE 'profile:%'");
  });

  it('wraps session ids without double prefixing', () => {
    expect(wrapSessionForProfile('work', 'tui:1')).toBe('profile:work:tui:1');
    expect(wrapSessionForProfile('work', 'profile:work:tui:1')).toBe('profile:work:tui:1');
  });

  it('switch profile is reversible via stack', async () => {
    await setup();
    await createProfile('alpha');
    await createProfile('beta');
    switchProfile('alpha');
    expect(getActiveProfileName()).toBe('alpha');
    expect(getActiveProfileOrDefault()).toBe('alpha');

    switchProfile('beta');
    expect(getActiveProfileName()).toBe('beta');
    expect(peekPreviousProfile()).toBe('alpha');

    const restored = switchProfileBack();
    expect(restored?.name).toBe('alpha');
    expect(getActiveProfileName()).toBe('alpha');
  });

  it('creates isolated extensions and packs dirs per profile', async () => {
    await setup();
    const profile = await createProfile('isolated');
    await expect(fs.stat(path.join(profile.dir, 'extensions'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(profile.dir, 'packs'))).resolves.toBeDefined();
  });
});
