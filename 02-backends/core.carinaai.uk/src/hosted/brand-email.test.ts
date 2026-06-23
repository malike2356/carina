import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    hosted: { appHost: 'app.carinaai.uk' },
    resend: { from: 'Carina <hello@carinaai.uk>' },
    product: { coreUrl: 'https://core.carinaai.uk' },
  },
}));

const queryMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('./custom-domain-service.js', () => ({
  getCanonicalHostForOrg: vi.fn(async () => 'workspace.client.example'),
}));

import { formatResendFrom, resolveEmailIdentityForOrg } from './brand-email.js';

describe('brand-email', () => {
  it('formats resend from header with sender name and email', () => {
    expect(formatResendFrom('Nova Cloud', 'noreply@client.example')).toBe(
      'Nova Cloud <noreply@client.example>',
    );
  });

  it('resolves tenant email identity from org and partner brand layers', async () => {
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        name: 'Acme Ops',
        brand: { productName: 'Acme Workspace', senderName: 'Acme Team', senderEmail: 'team@acme.example' },
        partner_brand: { productName: 'Partner Cloud' },
      }],
    });

    const identity = await resolveEmailIdentityForOrg('org-1');
    expect(identity.productName).toBe('Acme Workspace');
    expect(identity.from).toBe('Acme Team <team@acme.example>');
    expect(identity.appHost).toBe('workspace.client.example');
  });
});
