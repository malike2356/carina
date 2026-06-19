import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('../config/load-env.js', () => ({
  loadCarinaEnv: vi.fn(),
  envExists: vi.fn(() => false),
}));

vi.mock('../cli/config/loader.js', () => ({
  applyYamlConfigToEnv: vi.fn(),
}));

describe('gateway-exposure', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.CARINA_BIND;
    delete process.env.WEB_HOST;
    delete process.env.CARINA_WEB_PASSWORD;
    delete process.env.CARINA_OPS_TOKEN;
    delete process.env.CARINA_CHANNEL_DM_PAIRING;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects public bind hosts', async () => {
    const { isPublicBindHost } = await import('./gateway-exposure.js');
    expect(isPublicBindHost('0.0.0.0')).toBe(true);
    expect(isPublicBindHost('127.0.0.1')).toBe(false);
    expect(isPublicBindHost('localhost')).toBe(false);
  });

  it('flags messenger channels without DM pairing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    const { collectGatewayExposureChecks } = await import('./gateway-exposure.js');
    const checks = collectGatewayExposureChecks('127.0.0.1');
    const dm = checks.find((c) => c.id === 'channel-dm-pairing');
    expect(dm?.severity).toBe('fail');
  });

  it('warns on public bind without web auth', async () => {
    vi.stubEnv('CARINA_WEB_PASSWORD', '');
    vi.stubEnv('CARINA_OPS_TOKEN', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    const { formatGatewayExposureWarning } = await import('./gateway-exposure.js');
    const warning = formatGatewayExposureWarning('0.0.0.0');
    expect(warning).toContain('WARNING');
    expect(warning).toContain('CARINA_WEB_PASSWORD');
  });
});

describe('channel-security-defaults', () => {
  let tmpHome = '';

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-sec-defaults-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    await fs.rm(tmpHome, { recursive: true, force: true });
    delete process.env.CARINA_HOME;
  });

  it('persists DM pairing defaults for messenger starter channels', async () => {
    const { persistChannelSecurityDefaults } = await import('./channel-security-defaults.js');
    const lines = await persistChannelSecurityDefaults('telegram');
    expect(lines).toContain('CARINA_CHANNEL_DM_PAIRING=true');

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('CARINA_CHANNEL_DM_PAIRING=true');
    expect(env).toContain('CARINA_APPROVAL_POLICY=on');
  });

  it('skips defaults for web-only onboarding choice', async () => {
    const { persistChannelSecurityDefaults } = await import('./channel-security-defaults.js');
    const lines = await persistChannelSecurityDefaults('web');
    expect(lines).toEqual([]);
  });
});
