import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  createProfile,
  describeProfile,
  listProfiles,
} from './manager.js';

let tmpRoot: string;
const originalProfilesDir = process.env.CARINA_PROFILES_DIR;

async function setup(): Promise<void> {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-profiles-'));
  process.env.CARINA_PROFILES_DIR = tmpRoot;
}

afterEach(async () => {
  process.env.CARINA_PROFILES_DIR = originalProfilesDir;
  if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
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
});
