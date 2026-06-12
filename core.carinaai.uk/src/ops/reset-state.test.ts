import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeReset, planReset } from './reset-state.js';

describe('reset-state', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-reset-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    fs.mkdirSync(path.join(tmpHome, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, 'sessions', 'a.json'), '{}');
    fs.writeFileSync(path.join(tmpHome, 'config.yaml'), 'agent: test\n');
    fs.mkdirSync(path.join(tmpHome, 'backups'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('soft reset requires force', async () => {
    await expect(executeReset('soft')).rejects.toThrow(/force/);
  });

  it('soft reset removes sessions but keeps config', async () => {
    const dry = await executeReset('soft', { dryRun: true, homeDir: tmpHome });
    expect(dry.removed).toContain('sessions');
    await executeReset('soft', { force: true, homeDir: tmpHome });
    expect(fs.existsSync(path.join(tmpHome, 'sessions'))).toBe(false);
    expect(fs.existsSync(path.join(tmpHome, 'config.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, 'backups'))).toBe(true);
  });

  it('plan documents warnings per scope', async () => {
    const soft = await planReset('soft', tmpHome);
    const full = await planReset('full', tmpHome);
    expect(soft.items).toContain('sessions');
    expect(full.items).toContain('config.yaml');
    expect(full.warnings.some((w) => w.includes('Backups'))).toBe(true);
  });
});
