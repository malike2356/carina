import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../channels/credential-store.js', () => ({
  encryptCredentials: vi.fn((obj: Record<string, string>) => JSON.stringify(obj)),
  decryptCredentials: vi.fn((str: string) => JSON.parse(str) as Record<string, string>),
  credentialsConfigured: vi.fn(() => true),
}));

import { pool } from '../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../channels/credential-store.js';
import {
  readDomainSettings,
  writeSetting,
  saveDomainSettings,
  isDomainConfigured,
  deleteSetting,
} from './settings-store.js';

const poolQueryMock = vi.mocked(pool.query);
const encryptMock = vi.mocked(encryptCredentials);
const decryptMock = vi.mocked(decryptCredentials);

describe('readDomainSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when no rows found', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] } as never);
    const result = await readDomainSettings('provider:openai', null);
    expect(result).toEqual({});
  });

  it('returns plain values without decryption', async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{ key: 'OPENAI_API_KEY', value_enc: null, value_plain: 'sk-test' }],
    } as never);
    const result = await readDomainSettings('provider:openai', null);
    expect(result['OPENAI_API_KEY']).toBe('sk-test');
    expect(decryptMock).not.toHaveBeenCalled();
  });

  it('decrypts encrypted values', async () => {
    const encrypted = JSON.stringify({ OPENAI_API_KEY: 'sk-real' });
    decryptMock.mockReturnValue({ OPENAI_API_KEY: 'sk-real' });
    poolQueryMock.mockResolvedValue({
      rows: [{ key: 'OPENAI_API_KEY', value_enc: encrypted, value_plain: null }],
    } as never);
    const result = await readDomainSettings('provider:openai', null);
    expect(result['OPENAI_API_KEY']).toBe('sk-real');
    expect(decryptMock).toHaveBeenCalledWith(encrypted);
  });
});

describe('writeSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQueryMock.mockResolvedValue({ rows: [] } as never);
  });

  it('encrypts sensitive values', async () => {
    encryptMock.mockReturnValue('encrypted-blob');
    await writeSetting({
      domainId: 'provider:openai',
      key: 'OPENAI_API_KEY',
      value: 'sk-secret',
      sensitive: true,
      workspaceId: null,
    });
    expect(encryptMock).toHaveBeenCalled();
    const call = poolQueryMock.mock.calls[0];
    expect(call).toBeDefined();
    // The encrypted blob should be in the query parameters, not the plaintext
    const sqlArgs = JSON.stringify(call);
    expect(sqlArgs).not.toContain('sk-secret');
  });

  it('stores non-sensitive values as plain text', async () => {
    await writeSetting({
      domainId: 'workspace:timezone',
      key: 'CARINA_TIMEZONE',
      value: 'Europe/London',
      sensitive: false,
      workspaceId: null,
    });
    expect(encryptMock).not.toHaveBeenCalled();
    const sqlArgs = JSON.stringify(poolQueryMock.mock.calls);
    expect(sqlArgs).toContain('Europe/London');
  });

  it('sets process.env when envVar is provided', async () => {
    const prevValue = process.env['CARINA_TIMEZONE'];
    await writeSetting({
      domainId: 'workspace:timezone',
      key: 'CARINA_TIMEZONE',
      value: 'America/New_York',
      sensitive: false,
      envVar: 'CARINA_TIMEZONE',
      workspaceId: null,
    });
    expect(process.env['CARINA_TIMEZONE']).toBe('America/New_York');
    // cleanup
    if (prevValue === undefined) delete process.env['CARINA_TIMEZONE'];
    else process.env['CARINA_TIMEZONE'] = prevValue;
  });

  it('returns ok: false on db error', async () => {
    poolQueryMock.mockRejectedValue(new Error('db down'));
    const result = await writeSetting({
      domainId: 'provider:openai',
      key: 'OPENAI_API_KEY',
      value: 'sk-test',
      sensitive: true,
      workspaceId: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('isDomainConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no rows exist for domain', async () => {
    poolQueryMock.mockResolvedValue({ rows: [] } as never);
    const result = await isDomainConfigured('provider:openai', null);
    expect(result).toBe(false);
  });

  it('returns true when at least one row exists', async () => {
    poolQueryMock.mockResolvedValue({ rows: [{ count: '1' }] } as never);
    const result = await isDomainConfigured('provider:openai', null);
    expect(result).toBe(true);
  });
});

describe('deleteSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQueryMock.mockResolvedValue({ rows: [] } as never);
  });

  it('executes a DELETE query with the correct key', async () => {
    await deleteSetting('OPENAI_API_KEY', null);
    expect(poolQueryMock).toHaveBeenCalled();
    const callArgs = JSON.stringify(poolQueryMock.mock.calls);
    expect(callArgs).toContain('OPENAI_API_KEY');
  });
});

describe('saveDomainSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    poolQueryMock.mockResolvedValue({ rows: [] } as never);
    encryptMock.mockReturnValue('encrypted');
  });

  it('writes each provided field', async () => {
    const { ALL_CONFIG_DOMAINS } = await import('./settings-requirements.js');
    const domain = ALL_CONFIG_DOMAINS.find((d) => d.id === 'workspace:timezone')!;

    await saveDomainSettings(domain, { WORKSPACE_TIMEZONE: 'UTC' }, null);
    expect(poolQueryMock).toHaveBeenCalled();
  });

  it('skips fields not in values', async () => {
    const { ALL_CONFIG_DOMAINS } = await import('./settings-requirements.js');
    const domain = ALL_CONFIG_DOMAINS.find((d) => d.id === 'integration:trello')!;

    // Only provide API key, skip token
    await saveDomainSettings(domain, { TRELLO_API_KEY: 'key-value' }, null);
    // Should have been called once (for the one provided field)
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
  });

  it('returns ok: true on success', async () => {
    const { ALL_CONFIG_DOMAINS } = await import('./settings-requirements.js');
    const domain = ALL_CONFIG_DOMAINS.find((d) => d.id === 'workspace:timezone')!;

    const result = await saveDomainSettings(domain, { WORKSPACE_TIMEZONE: 'UTC' }, null);
    expect(result.ok).toBe(true);
  });
});
