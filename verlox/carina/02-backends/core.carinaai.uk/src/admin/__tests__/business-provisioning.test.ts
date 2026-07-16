import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateHostedAccount = vi.fn();
const mockCreatePasswordResetLoginUrl = vi.fn();
const mockUpsertPaddleSubscription = vi.fn();
const mockCreateCustomDomainForOrg = vi.fn();
const mockSendBusinessProvisionWelcomeEmail = vi.fn();
const mockUpsertWorkspaceContact = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock('../../api/hosted-auth.js', () => ({
  createHostedAccountForProvisioning: (...args: unknown[]) => mockCreateHostedAccount(...args),
  createPasswordResetLoginUrl: (...args: unknown[]) => mockCreatePasswordResetLoginUrl(...args),
}));

vi.mock('../../billing/paddle/paddle-subscription-store.js', () => ({
  upsertPaddleSubscription: (...args: unknown[]) => mockUpsertPaddleSubscription(...args),
}));

vi.mock('../../hosted/custom-domain-service.js', () => ({
  buildCnameTarget: (id: string) => `${id}.hireaiva.co.uk`,
  createCustomDomainForOrg: (...args: unknown[]) => mockCreateCustomDomainForOrg(...args),
}));

vi.mock('../../email/email-triggers.js', () => ({
  sendBusinessProvisionWelcomeEmail: (...args: unknown[]) =>
    mockSendBusinessProvisionWelcomeEmail(...args),
}));

vi.mock('../../email/workspace-contact.js', () => ({
  upsertWorkspaceContact: (...args: unknown[]) => mockUpsertWorkspaceContact(...args),
}));

vi.mock('../../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => mockPoolQuery(...args) },
}));

describe('provisionBusinessWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateHostedAccount.mockResolvedValue({ userId: 'user-1', workspaceId: 'ws-1' });
    mockCreatePasswordResetLoginUrl.mockResolvedValue('https://app.hireaiva.co.uk/hosted-reset?token=abc');
    mockUpsertPaddleSubscription.mockResolvedValue(undefined);
    mockUpsertWorkspaceContact.mockResolvedValue(undefined);
    mockSendBusinessProvisionWelcomeEmail.mockResolvedValue(undefined);
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('returns workspaceId and loginUrl on success', async () => {
    const { provisionBusinessWorkspace } = await import('../business-provisioning.js');
    const result = await provisionBusinessWorkspace({
      email: 'client@example.com',
      workspaceName: 'Acme Ltd',
      sendWelcomeEmail: true,
    });
    expect(result.workspaceId).toBe('ws-1');
    expect(result.loginUrl).toContain('hosted-reset?token=');
    expect(mockCreateCustomDomainForOrg).not.toHaveBeenCalled();
    expect(mockSendBusinessProvisionWelcomeEmail).toHaveBeenCalledOnce();
  });

  it('registers custom domain and returns CNAME target', async () => {
    mockCreateCustomDomainForOrg.mockResolvedValue({
      id: 'dom-1',
      hostname: 'aiva.client.com',
      cfHostnameId: 'cf-123',
      cnameTarget: 'cf-123.hireaiva.co.uk',
      cfOwnershipVerificationName: '_cf-custom-hostname.aiva.client.com',
      cfOwnershipVerificationValue: 'verify-token',
    });
    const { provisionBusinessWorkspace } = await import('../business-provisioning.js');
    const result = await provisionBusinessWorkspace({
      email: 'client@example.com',
      workspaceName: 'Acme Ltd',
      customDomain: 'aiva.client.com',
      sendWelcomeEmail: false,
    });
    expect(mockCreateCustomDomainForOrg).toHaveBeenCalledWith('ws-1', 'aiva.client.com');
    expect(result.customDomainRow?.cnameTarget).toBe('cf-123.hireaiva.co.uk');
    expect(mockSendBusinessProvisionWelcomeEmail).not.toHaveBeenCalled();
  });

  it('skips custom domain registration when not provided', async () => {
    const { provisionBusinessWorkspace } = await import('../business-provisioning.js');
    await provisionBusinessWorkspace({
      email: 'client@example.com',
      workspaceName: 'Acme Ltd',
      sendWelcomeEmail: false,
    });
    expect(mockCreateCustomDomainForOrg).not.toHaveBeenCalled();
  });

  it('still provisions workspace when custom domain registration fails', async () => {
    mockCreateCustomDomainForOrg.mockRejectedValue(new Error('CF API down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { provisionBusinessWorkspace } = await import('../business-provisioning.js');
    const result = await provisionBusinessWorkspace({
      email: 'client@example.com',
      workspaceName: 'Acme Ltd',
      customDomain: 'aiva.client.com',
      sendWelcomeEmail: false,
    });
    expect(result.workspaceId).toBe('ws-1');
    expect(result.customDomainRow).toBeNull();
    expect(mockUpsertPaddleSubscription).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not send welcome email when sendWelcomeEmail is false', async () => {
    const { provisionBusinessWorkspace } = await import('../business-provisioning.js');
    await provisionBusinessWorkspace({
      email: 'client@example.com',
      workspaceName: 'Acme Ltd',
      sendWelcomeEmail: false,
    });
    expect(mockSendBusinessProvisionWelcomeEmail).not.toHaveBeenCalled();
  });
});
