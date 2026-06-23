import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyApiError, withCredentialRotation } from './credential-retry.js';
import { resetCredentialPoolManager } from './pool-manager.js';

describe('credential-retry', () => {
  let tmpFile: string;

  beforeEach(() => {
    resetCredentialPoolManager();
    tmpFile = path.join(os.tmpdir(), `carina-retry-${Date.now()}.json`);
    process.env.CARINA_CREDENTIALS_FILE = tmpFile;
  });

  afterEach(() => {
    delete process.env.CARINA_CREDENTIALS_FILE;
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    resetCredentialPoolManager();
  });

  it('classifies rate limit errors', () => {
    expect(classifyApiError({ status: 429 })).toBe('rate_limit');
    expect(classifyApiError(new Error('Rate limit exceeded'))).toBe('rate_limit');
  });

  it('retries with next pool key on auth failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce('ok');

    const result = await withCredentialRotation('openai', '', 'key1,key2', fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0]?.[0]).toBe('key1');
    expect(fn.mock.calls[1]?.[0]).toBe('key2');
  });
});
