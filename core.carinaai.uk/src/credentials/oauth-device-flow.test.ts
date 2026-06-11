import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pollDeviceFlow,
  runDeviceFlowInteractive,
  startDeviceFlow,
} from './oauth-device-flow.js';

describe('oauth-device-flow', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `carina-oauth-${Date.now()}.json`);
    process.env.CARINA_CREDENTIALS_FILE = tmpFile;
    process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CARINA_CREDENTIALS_FILE;
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('starts device flow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      device_code: 'device123',
      user_code: 'ABCD-1234',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 1,
    }), { status: 200 }));

    const start = await startDeviceFlow('github');
    expect(start.userCode).toBe('ABCD-1234');
    expect(start.deviceCode).toBe('device123');
  });

  it('polls until success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        device_code: 'device123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 1,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'gho_test_token',
        token_type: 'bearer',
        scope: 'read:user',
      }), { status: 200 }));

    const token = await runDeviceFlowInteractive('github', {
      sleep: async () => {},
      pollMs: () => 0,
      onPrompt: () => {},
    });

    expect(token).toBe('gho_test_token');
  });

  it('returns pending on authorization_pending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'authorization_pending',
    }), { status: 400 }));

    const result = await pollDeviceFlow('github', 'device123');
    expect(result.status).toBe('pending');
  });
});
