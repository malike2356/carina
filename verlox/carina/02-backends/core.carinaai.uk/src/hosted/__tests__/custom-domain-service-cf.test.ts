import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const registerMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../../memory/db.js', () => ({ pool: { query } }));

vi.mock('../cloudflare-saas.js', () => ({
  registerCfCustomHostname: (...args: unknown[]) => registerMock(...args),
  deleteCfCustomHostname: (...args: unknown[]) => deleteMock(...args),
  getCfCustomHostname: vi.fn(),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn(() => Buffer.from('aabbccdd112233445566778899aabbcc', 'hex')),
    },
  };
});

const baseRow = {
  id: 'domain-1',
  hostname: 'aiva.client.com',
  partner_id: null,
  org_id: 'org-1',
  verified_at: null,
  tls_status: 'pending',
  created_at: '2026-07-04T00:00:00.000Z',
  verification_token: 'token-1',
  is_canonical: false,
  cf_hostname_id: null,
  cf_ownership_verification_name: null,
  cf_ownership_verification_value: null,
  cf_ssl_status: null,
};

describe('custom-domain-service CF integration', () => {
  beforeEach(() => {
    query.mockReset();
    registerMock.mockReset();
    deleteMock.mockReset();
  });

  it('createCustomDomainForOrg calls registerCfCustomHostname after insert', async () => {
    registerMock.mockResolvedValueOnce({
      id: 'cf-host-1',
      hostname: 'aiva.client.com',
      ownershipVerification: {
        type: 'txt',
        name: '_cf.aiva.client.com',
        value: 'verify',
      },
      sslStatus: 'pending',
      status: 'pending',
    });

    query
      .mockResolvedValueOnce({ rows: [{ ...baseRow }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          ...baseRow,
          cf_hostname_id: 'cf-host-1',
          cf_ownership_verification_name: '_cf.aiva.client.com',
          cf_ownership_verification_value: 'verify',
          cf_ssl_status: 'pending',
        }],
        rowCount: 1,
      });

    const { createCustomDomainForOrg } = await import('../custom-domain-service.js');
    const domain = await createCustomDomainForOrg('org-1', 'aiva.client.com');

    expect(registerMock).toHaveBeenCalledWith('aiva.client.com');
    expect(domain.cfHostnameId).toBe('cf-host-1');
    expect(domain.cnameTarget).toBe('cf-host-1.hireaiva.co.uk');
    const updateCall = query.mock.calls[1] as [string, unknown[]];
    expect(updateCall[0]).toContain('cf_hostname_id');
    expect(updateCall[1]).toEqual([
      'cf-host-1',
      '_cf.aiva.client.com',
      'verify',
      'pending',
      'domain-1',
    ]);
  });

  it('deleteCustomDomainForOrg calls deleteCfCustomHostname when cf_hostname_id is present', async () => {
    deleteMock.mockResolvedValueOnce(undefined);
    query
      .mockResolvedValueOnce({
        rows: [{ ...baseRow, cf_hostname_id: 'cf-host-1' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const { deleteCustomDomainForOrg } = await import('../custom-domain-service.js');
    const deleted = await deleteCustomDomainForOrg('org-1', 'domain-1');

    expect(deleted).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith('cf-host-1');
  });

  it('deleteCustomDomainForOrg does not throw if CF delete returns 404', async () => {
    deleteMock.mockRejectedValueOnce(new Error('CF custom hostname deletion failed: 404'));
    query
      .mockResolvedValueOnce({
        rows: [{ ...baseRow, cf_hostname_id: 'cf-host-1' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const { deleteCustomDomainForOrg } = await import('../custom-domain-service.js');
    await expect(deleteCustomDomainForOrg('org-1', 'domain-1')).resolves.toBe(true);
  });
});
