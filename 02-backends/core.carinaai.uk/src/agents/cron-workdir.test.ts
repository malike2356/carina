import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { resolveCronWorkdir } from './cron-workdir.js';

describe('resolveCronWorkdir', () => {
  it('expands home paths', () => {
    const resolved = resolveCronWorkdir('~/');
    expect(resolved).toBe(path.resolve(os.homedir()));
  });

  it('rejects blocked system paths', () => {
    expect(() => resolveCronWorkdir('/etc')).toThrow('workdir is not allowed');
  });
});
