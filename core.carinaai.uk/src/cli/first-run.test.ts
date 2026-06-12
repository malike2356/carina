import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('first-run bootstrap', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-first-run-'));
    process.env.CARINA_HOME = tmpHome;
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('writes minimal env and config without API keys', async () => {
    const { writeMinimalBootstrap } = await import('./first-run.js');
    await writeMinimalBootstrap();

    const envPath = path.join(tmpHome, '.env');
    const configPath = path.join(tmpHome, 'config.yaml');
    const env = await fs.readFile(envPath, 'utf-8');
    expect(env).toContain('CARINA_LOCAL_MODE=true');
    expect(env).not.toMatch(/^DEEPSEEK_API_KEY=\S/m);
    await expect(fs.access(configPath)).resolves.toBeUndefined();
  });
});
