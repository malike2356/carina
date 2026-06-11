import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readEnvValue } from './core-env.js';

describe('core-env', () => {
  const tmpDir = path.join(os.tmpdir(), `ops-core-env-${Date.now()}`);
  let envPath = '';

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    envPath = path.join(tmpDir, '.env');
    await fs.writeFile(envPath, 'CARINA_OPS_TOKEN=secret-token-123\n', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads values from an env file', () => {
    expect(readEnvValue(envPath, 'CARINA_OPS_TOKEN')).toBe('secret-token-123');
    expect(readEnvValue(envPath, 'MISSING')).toBeNull();
  });
});
