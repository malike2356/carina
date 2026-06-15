import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTenantWorkspaceConfig, saveTenantWorkspaceConfig } from './tenant-workspace-config.js';

describe('tenant-workspace-config', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-tenant-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('loads default tenant config', () => {
    const config = loadTenantWorkspaceConfig('tenant-a');
    expect(config.tenantId).toBe('tenant-a');
    expect(config.channels.web?.enabled).toBe(true);
  });

  it('saves skill packs and channels', () => {
    const config = saveTenantWorkspaceConfig('tenant-a', {
      activeSkillPacks: ['finance'],
      channels: { telegram: { enabled: true, botUsername: 'carina_bot' } },
    });
    expect(config.activeSkillPacks).toEqual(['finance']);
    expect(config.channels.telegram?.enabled).toBe(true);
    const reloaded = loadTenantWorkspaceConfig('tenant-a');
    expect(reloaded.activeSkillPacks).toEqual(['finance']);
  });
});
