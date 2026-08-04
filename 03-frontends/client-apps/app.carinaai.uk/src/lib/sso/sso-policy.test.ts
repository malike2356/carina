import { describe, expect, it } from 'vitest';
import { emailDomainMatchesProvider } from './policy';
import { normalizeCertificate, validateCertificatePem } from './saml-client';

describe('sso policy', () => {
  it('matches email domain to provider domain', () => {
    expect(emailDomainMatchesProvider('user@acme.com', 'acme.com')).toBe(true);
    expect(emailDomainMatchesProvider('user@other.com', 'acme.com')).toBe(false);
  });
});

describe('saml certificate helpers', () => {
  const sampleCertBody = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKOs5Kw0KODvDbwXo3o/fWSOcfnL/NE75bYEPBleB99TwetF';

  it('wraps bare certificate bodies in PEM markers', () => {
    const pem = normalizeCertificate(sampleCertBody);
    expect(pem).toContain('BEGIN CERTIFICATE');
    expect(pem).toContain('END CERTIFICATE');
  });

  it('validates PEM certificate shape', () => {
    expect(validateCertificatePem(sampleCertBody)).toBe(true);
    expect(validateCertificatePem('not-a-cert')).toBe(false);
  });
});
