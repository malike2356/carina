import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('loadCarinaEnv', () => {
  let tmpHome: string;
  let tmpCwd: string;
  let previousCwd: string;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    previousCwd = process.cwd();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-home-'));
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cwd-'));
    process.chdir(tmpCwd);
    vi.stubEnv('CARINA_HOME', tmpHome);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('does not let ~/.carina/.env overwrite Docker-provided keys', async () => {
    process.env.GEMINI_API_KEY = 'from-docker';
    process.env.OPENAI_API_KEY = 'from-docker-openai';
    fs.mkdirSync(path.join(tmpHome), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHome, '.env'),
      'GEMINI_API_KEY=from-file\nOPENAI_API_KEY=from-file-openai\nEXTRA_FROM_FILE=1\n',
    );

    const { loadCarinaEnv } = await import('./load-env.js');
    loadCarinaEnv();

    expect(process.env.GEMINI_API_KEY).toBe('from-docker');
    expect(process.env.OPENAI_API_KEY).toBe('from-docker-openai');
    expect(process.env.EXTRA_FROM_FILE).toBe('1');
  });

  it('lets ~/.carina/.env fill keys that were not already set', async () => {
    delete process.env.GEMINI_API_KEY;
    fs.writeFileSync(path.join(tmpHome, '.env'), 'GEMINI_API_KEY=from-file\n');
    const { loadCarinaEnv } = await import('./load-env.js');
    loadCarinaEnv();
    expect(process.env.GEMINI_API_KEY).toBe('from-file');
  });
});
