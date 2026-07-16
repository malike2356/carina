import { describe, expect, it } from 'vitest';
import {
  canonicalAppHost,
  dnsVerificationRecordName,
  isCanonicalAppHost,
  normaliseCustomDomainHostname,
  verificationTxtValue,
} from './custom-domains';

describe('custom-domains helpers', () => {
  it('normalises hostnames and detects canonical app host', () => {
    process.env.CARINA_HOSTED_APP_HOST = 'app.carinaai.uk';
    expect(normaliseCustomDomainHostname(' Workspace.Client.EXAMPLE ')).toBe('workspace.client.example');
    expect(canonicalAppHost()).toBe('app.carinaai.uk');
    expect(isCanonicalAppHost('app.carinaai.uk')).toBe(true);
    expect(isCanonicalAppHost('workspace.client.example')).toBe(false);
  });

  it('builds explicit DNS verification instructions', () => {
    const token = 'abc123';
    expect(dnsVerificationRecordName('workspace.client.example')).toBe('_carina-verify.workspace.client.example');
    expect(verificationTxtValue(token)).toBe('carina-verify=abc123');
  });
});
