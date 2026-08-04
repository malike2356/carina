import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportCarinaBundle } from './interop-bundle.js';

describe('interop-bundle selective export', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-export-'));
    fs.writeFileSync(path.join(tmpHome, 'config.yaml'), 'provider: test\n', 'utf8');
    fs.mkdirSync(path.join(tmpHome, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, 'session-lineage.json'), '{"version":1}\n', 'utf8');
    fs.mkdirSync(path.join(tmpHome, 'workspaces'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('exports only requested items', async () => {
    const result = await exportCarinaBundle({
      homeDir: tmpHome,
      label: 'selective-test',
      filters: {
        items: ['config.yaml', 'session-lineage.json'],
        includeSessions: false,
        includeWorkspaces: false,
      },
    });

    expect(result.manifest.selective).toBe(true);
    expect(result.manifest.items).toContain('config.yaml');
    expect(result.manifest.items).toContain('session-lineage.json');
    expect(result.manifest.items).not.toContain('sessions');
    expect(fs.existsSync(path.join(result.path, 'interop-manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.path, 'config.yaml'))).toBe(true);
  });
});
