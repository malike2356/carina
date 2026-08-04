import { afterEach, describe, expect, it } from 'vitest';
import {
  buildGoogleAuthorizeUrl,
  createGoogleOidcState,
  googleOidcCallbackUrl,
  isEmailDomainAllowed,
  isGoogleOidcConfigured,
  parseAllowedDomains,
  validateGoogleOidcProfile,
} from './google-oidc.js';

describe('google-oidc', () => {
  afterEach(() => {
    delete process.env.OPS_GOOGLE_OIDC_CLIENT_ID;
    delete process.env.OPS_GOOGLE_OIDC_CLIENT_SECRET;
    delete process.env.OPS_GOOGLE_OIDC_ALLOWED_DOMAINS;
    delete process.env.OPS_GOOGLE_OIDC_HOSTED_DOMAIN;
    delete process.env.OPS_PUBLIC_URL;
  });

  it('reports configured when client id and secret are set', () => {
    process.env.OPS_GOOGLE_OIDC_CLIENT_ID = 'client-id';
    process.env.OPS_GOOGLE_OIDC_CLIENT_SECRET = 'client-secret';
    expect(isGoogleOidcConfigured()).toBe(true);
  });

  it('builds authorize URL with hosted domain when configured', () => {
    process.env.OPS_PUBLIC_URL = 'https://ops.carinaai.uk';
    process.env.OPS_GOOGLE_OIDC_CLIENT_ID = 'client-id';
    process.env.OPS_GOOGLE_OIDC_CLIENT_SECRET = 'client-secret';
    process.env.OPS_GOOGLE_OIDC_HOSTED_DOMAIN = 'verlox.uk';
    const url = buildGoogleAuthorizeUrl('state-123');
    expect(url).toContain('client_id=client-id');
    expect(url).toContain(encodeURIComponent(googleOidcCallbackUrl()));
    expect(url).toContain('hd=verlox.uk');
    expect(url).toContain('state=state-123');
  });

  it('defaults allowed domains to verlox.uk', () => {
    expect(parseAllowedDomains()).toEqual(['verlox.uk']);
    expect(isEmailDomainAllowed('ops@verlox.uk')).toBe(true);
    expect(isEmailDomainAllowed('ops@gmail.com')).toBe(false);
  });

  it('accepts custom allowed domains', () => {
    process.env.OPS_GOOGLE_OIDC_ALLOWED_DOMAINS = 'verlox.uk,carinaai.uk';
    expect(isEmailDomainAllowed('admin@carinaai.uk')).toBe(true);
  });

  it('rejects unverified Google emails', () => {
    expect(validateGoogleOidcProfile({
      sub: '1',
      email: 'ops@verlox.uk',
      emailVerified: false,
      name: 'Ops',
    })).toMatch(/not verified/i);
  });

  it('creates random oauth state', () => {
    expect(createGoogleOidcState()).not.toBe(createGoogleOidcState());
  });
});
