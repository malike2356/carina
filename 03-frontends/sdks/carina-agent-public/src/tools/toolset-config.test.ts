import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultEnabledToolsets,
  describePlatformToolsets,
  hasToolsetsConfig,
  loadToolsetsConfig,
  resolveActiveToolNames,
  resolvePlatformEnabledToolsets,
  saveToolsetsConfig,
  setPlatformToolsets,
  togglePlatformToolset,
} from './toolset-config.js';

describe('toolset-config', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `carina-toolsets-${Date.now()}.yaml`);
    process.env.CARINA_TOOLSETS_FILE = tmpFile;
  });

  afterEach(() => {
    delete process.env.CARINA_TOOLSETS_FILE;
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('returns undefined active tools when no config file', () => {
    expect(hasToolsetsConfig()).toBe(false);
    expect(resolveActiveToolNames({ platform: 'telegram' })).toBeUndefined();
  });

  it('applies platform presets for telegram', () => {
    const tools = resolveActiveToolNames({
      platform: 'telegram',
      config: { default: { enabled: [] }, platforms: {} },
    });
    expect(tools).toBeDefined();
    expect(tools).toContain('send-message');
    expect(tools).not.toContain('shell-exec');
  });

  it('cli preset includes terminal tools', () => {
    const tools = resolveActiveToolNames({
      platform: 'cli',
      config: { default: { enabled: [] }, platforms: {} },
    });
    expect(tools).toContain('shell-exec');
  });

  it('persists per-platform overrides', async () => {
    await saveToolsetsConfig(setPlatformToolsets('discord', ['messaging'], {}), tmpFile);
    const cfg = loadToolsetsConfig(tmpFile);
    expect(resolvePlatformEnabledToolsets(cfg, 'discord')).toEqual(['messaging']);
    const info = describePlatformToolsets('discord', cfg);
    expect(info.usingPreset).toBe(false);
    expect(info.toolCount).toBeGreaterThan(0);
  });

  it('toggles platform toolsets', async () => {
    const next = togglePlatformToolset('slack', 'browser', true, {
      platforms: { slack: { enabled: ['messaging'] } },
    });
    expect(resolvePlatformEnabledToolsets(next, 'slack')).toContain('browser');
  });

  it('sms preset is minimal', () => {
    const sets = defaultEnabledToolsets('sms');
    expect(sets).toContain('messaging');
    expect(sets).not.toContain('terminal');
  });
});
