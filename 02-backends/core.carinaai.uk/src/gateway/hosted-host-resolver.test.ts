import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    hosted: { appHost: 'app.carinaai.uk', operatorHosts: ['core.carinaai.uk'], enabled: true },
    product: { domain: 'carinaai.uk' },
  },
}));

const lookupMock = vi.fn();

vi.mock('../hosted/custom-domain-service.js', () => ({
  lookupVerifiedCustomDomain: (...args: unknown[]) => lookupMock(...args),
}));

import { resolveHostedHostContext } from './hosted-host-resolver.js';

describe('hosted-host-resolver', () => {
  beforeEach(() => {
    process.env.CARINA_HOSTED_APP_HOST = 'app.carinaai.uk';
    process.env.CARINA_CONTROL_PLANE_HOSTS = 'core.carinaai.uk,ops.carinaai.uk';
    process.env.CARINA_OPERATOR_HOSTS = 'core.carinaai.uk';
    lookupMock.mockReset();
  });

  it('returns canonical context for app.carinaai.uk', async () => {
    const ctx = await resolveHostedHostContext('app.carinaai.uk');
    expect(ctx.isCanonical).toBe(true);
    expect(ctx.isCustomDomain).toBe(false);
    expect(ctx.orgId).toBeNull();
  });

  it('returns control plane context for core host', async () => {
    const ctx = await resolveHostedHostContext('core.carinaai.uk');
    expect(ctx.isControlPlane).toBe(true);
    expect(ctx.orgId).toBeNull();
  });

  it('maps verified custom domains to org context', async () => {
    lookupMock.mockResolvedValueOnce({
      orgId: 'org-1',
      partnerId: 'partner-1',
      hostname: 'workspace.client.example',
      isCanonical: true,
    });
    const ctx = await resolveHostedHostContext('workspace.client.example');
    expect(ctx.isCustomDomain).toBe(true);
    expect(ctx.orgId).toBe('org-1');
    expect(ctx.canonicalHost).toBe('workspace.client.example');
  });

  it('falls back to canonical host for unknown customer domains', async () => {
    lookupMock.mockResolvedValueOnce(null);
    const ctx = await resolveHostedHostContext('unknown.client.example');
    expect(ctx.isCustomDomain).toBe(false);
    expect(ctx.canonicalHost).toBe('app.carinaai.uk');
  });
});
