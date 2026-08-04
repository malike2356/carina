import { afterEach, describe, expect, it } from 'vitest';
import { resolveWebListenPort, shouldBootstrapHub } from './web-server.js';

describe('web server hub bootstrap gate', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('skips hub bootstrap in local mode', () => {
    expect(shouldBootstrapHub(true, 'postgresql://example')).toBe(false);
  });

  it('skips hub bootstrap when DATABASE_URL is missing', () => {
    expect(shouldBootstrapHub(false, '')).toBe(false);
    expect(shouldBootstrapHub(false, undefined)).toBe(false);
  });

  it('boots hub only when remote mode and a database URL are both present', () => {
    expect(shouldBootstrapHub(false, 'postgresql://example')).toBe(true);
  });
});

describe('web server port selection', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('prefers an explicit port option', () => {
    expect(resolveWebListenPort({ port: 4321 })).toBe(4321);
  });

  it('falls back to WEB_PORT, then PORT, then an ephemeral port', () => {
    delete process.env.WEB_PORT;
    delete process.env.PORT;
    expect(resolveWebListenPort({})).toBe(0);

    process.env.PORT = '5432';
    expect(resolveWebListenPort({})).toBe(5432);

    process.env.WEB_PORT = '6543';
    expect(resolveWebListenPort({})).toBe(6543);
  });
});
