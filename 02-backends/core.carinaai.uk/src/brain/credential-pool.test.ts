import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resetCredentialPoolManager } from '../credentials/pool-manager.js';
import { CredentialPool, parseKeyPool, resolveApiKey } from './credential-pool.js';

let tmpFile = '';

afterEach(() => {
  delete process.env.CARINA_CREDENTIALS_FILE;
  if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  resetCredentialPoolManager();
});

describe('credential-pool', () => {
  it('round-robins keys', () => {
    const pool = new CredentialPool(['a', 'b', 'c']);
    expect(pool.next()).toBe('a');
    expect(pool.next()).toBe('b');
    expect(pool.next()).toBe('c');
    expect(pool.next()).toBe('a');
  });

  it('parses comma-separated env pools', () => {
    const pool = parseKeyPool(' key1 , key2 ');
    expect(pool.size).toBe(2);
  });

  it('prefers pool over single key', () => {
    expect(resolveApiKey('single', 'pool1,pool2')).toBe('pool1');
    expect(resolveApiKey('', 'pool1,pool2')).toBe('pool1');
  });

  it('uses managed pool when provider is set', () => {
    tmpFile = path.join(os.tmpdir(), `carina-pool-${Date.now()}.json`);
    process.env.CARINA_CREDENTIALS_FILE = tmpFile;
    resetCredentialPoolManager();
    expect(resolveApiKey('single', 'pool1,pool2', 'openai')).toBe('single');
    expect(resolveApiKey('single', 'pool1,pool2', 'openai')).toBe('pool1');
  });
});
