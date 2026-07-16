import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldAutoBindPropreneur,
  resolvePropreneurGrantByEmail,
} from './propreneur-auto-bridge.js';

describe('shouldAutoBindPropreneur', () => {
  it('matches property-manager template', () => {
    expect(shouldAutoBindPropreneur({ templateId: 'property-manager' })).toBe(true);
  });

  it('matches property-uk skill pack', () => {
    expect(shouldAutoBindPropreneur({ skillPacks: ['communication', 'property-uk'] })).toBe(true);
  });

  it('skips unrelated roles', () => {
    expect(shouldAutoBindPropreneur({ templateId: 'outreach-coordinator', skillPacks: ['communication'] })).toBe(false);
  });
});

describe('resolvePropreneurGrantByEmail', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.PROPREENEUR_AUTO_BRIDGE_SECRET = 'test-secret';
    process.env.PROPREENEUR_CENTRAL_URL = 'https://propreneur.test';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.PROPREENEUR_AUTO_BRIDGE_SECRET;
    delete process.env.PROPREENEUR_CENTRAL_URL;
  });

  it('returns matched grant from central resolve', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          matched: true,
          tenant_slug: 'xelox',
          api_key: 'crm_testkey',
          company_name: 'Xelox',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await resolvePropreneurGrantByEmail('owner@example.com');
    expect(result).toEqual({
      matched: true,
      tenantSlug: 'xelox',
      apiKey: 'crm_testkey',
      companyName: 'Xelox',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://propreneur.test/api/aiva-auto-bridge/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Aiva-Auto-Bridge-Key': 'test-secret',
        }),
      }),
    );
  });

  it('returns unmatched on 404', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ matched: false }), { status: 404 }),
    ) as typeof fetch;

    const result = await resolvePropreneurGrantByEmail('missing@example.com');
    expect(result?.matched).toBe(false);
  });
});
