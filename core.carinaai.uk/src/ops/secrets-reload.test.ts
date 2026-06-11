import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { reloadEnvFromFile } from './secrets-reload.js';

const files: string[] = [];

afterEach(async () => {
  for (const file of files.splice(0)) {
    await fs.rm(file, { force: true });
  }
});

describe('secrets-reload', () => {
  it('overwrites process env from file', async () => {
    const file = path.join(os.tmpdir(), `carina-env-${Date.now()}.env`);
    files.push(file);
    await fs.writeFile(file, 'CARINA_OPS_TEST_KEY=from-file\n');
    const prev = process.env.CARINA_OPS_TEST_KEY;
    const result = reloadEnvFromFile(file, true);
    expect(result.reloaded).toContain('CARINA_OPS_TEST_KEY');
    expect(process.env.CARINA_OPS_TEST_KEY).toBe('from-file');
    if (prev === undefined) delete process.env.CARINA_OPS_TEST_KEY;
    else process.env.CARINA_OPS_TEST_KEY = prev;
  });
});
