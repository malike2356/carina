import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CredentialPoolManager, resetCredentialPoolManager } from './pool-manager.js';

describe('CredentialPoolManager', () => {
  let tmpFile: string;

  beforeEach(() => {
    resetCredentialPoolManager();
    tmpFile = path.join(os.tmpdir(), `carina-creds-${Date.now()}.json`);
    process.env.CARINA_CREDENTIALS_FILE = tmpFile;
  });

  afterEach(() => {
    delete process.env.CARINA_CREDENTIALS_FILE;
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    resetCredentialPoolManager();
  });

  it('round-robins pooled keys', () => {
    const mgr = new CredentialPoolManager();
    const keys = mgr.resolveKeys('openai', '', 'k1,k2,k3');
    expect(keys).toEqual(['k1', 'k2', 'k3']);
    expect(mgr.nextKey('openai', '', 'k1,k2,k3')).toBe('k1');
    expect(mgr.nextKey('openai', '', 'k1,k2,k3')).toBe('k2');
    expect(mgr.nextKey('openai', '', 'k1,k2,k3')).toBe('k3');
    expect(mgr.nextKey('openai', '', 'k1,k2,k3')).toBe('k1');
  });

  it('skips cooling-down keys after failure', () => {
    const mgr = new CredentialPoolManager(60_000);
    mgr.nextKey('groq', '', 'a,b');
    mgr.reportFailure('groq', 'a', 'rate_limit');
    const next = mgr.nextKey('groq', '', 'a,b');
    expect(next).toBe('b');
  });

  it('persists pool index to disk', () => {
    const mgr = new CredentialPoolManager();
    mgr.nextKey('deepseek', '', 'x,y');
    const mgr2 = new CredentialPoolManager();
    expect(mgr2.nextKey('deepseek', '', 'x,y')).toBe('y');
  });

  it('addKey merges into stored pool', () => {
    const mgr = new CredentialPoolManager();
    mgr.addKey('testpool', 'new-key-value');
    const pool = mgr.describePool('testpool');
    expect(pool.size).toBe(1);
    expect(pool.keys[0]?.redacted).toContain('new-');
  });

  it('removeKey retires by index and prefix', () => {
    const mgr = new CredentialPoolManager();
    mgr.addKey('demo', 'alpha-key-111');
    mgr.addKey('demo', 'beta-key-222');
    expect(mgr.removeKey('demo', '1')).toBe(true);
    expect(mgr.describePool('demo').size).toBe(1);
    expect(mgr.retireKey('demo', 'alpha')).toBe(true);
    expect(mgr.describePool('demo').size).toBe(0);
  });

  it('listConfiguredProviders includes stored pools', () => {
    const mgr = new CredentialPoolManager();
    mgr.addKey('customprov', 'secret-key-xyz');
    expect(mgr.listConfiguredProviders()).toContain('customprov');
  });

  it('prefers env primary key over stale stored pool keys', () => {
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        version: 1,
        pools: { deepseek: { keys: ['stale-key-8156'], index: 0, failures: {} } },
        oauth: {},
      }),
      { mode: 0o600 },
    );
    const mgr = new CredentialPoolManager();
    expect(mgr.resolveKeys('deepseek', 'fresh-key-98c', '')).toEqual([
      'fresh-key-98c',
      'stale-key-8156',
    ]);
    expect(mgr.nextKey('deepseek', 'fresh-key-98c', '')).toBe('fresh-key-98c');
  });
});
