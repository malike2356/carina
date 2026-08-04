import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('web gateway port helper', () => {
  let tmpHome = '';

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-web-port-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('prefers env port over persisted state', async () => {
    fs.writeFileSync(path.join(tmpHome, 'web-port.json'), JSON.stringify({ port: 4321, updatedAt: new Date().toISOString() }));
    vi.stubEnv('WEB_PORT', '5432');
    const { resolveKnownWebGatewayPort } = await import('./web-gateway-port.js');
    expect(resolveKnownWebGatewayPort()).toBe(5432);
  });

  it('falls back to persisted state when env is absent', async () => {
    fs.writeFileSync(path.join(tmpHome, 'web-port.json'), JSON.stringify({ port: 4321, updatedAt: new Date().toISOString() }));
    const { resolveKnownWebGatewayPort, resolveKnownWebGatewayUrl } = await import('./web-gateway-port.js');
    expect(resolveKnownWebGatewayPort()).toBe(4321);
    expect(resolveKnownWebGatewayUrl()).toBe('http://127.0.0.1:4321');
  });

  it('uses fallback when no env or persisted state exists', async () => {
    const { resolveKnownWebGatewayPort } = await import('./web-gateway-port.js');
    expect(resolveKnownWebGatewayPort()).toBe(7430);
  });
});
