import { describe, expect, it } from 'vitest';
import {
  dnsVerificationRecordName,
  normaliseCustomDomainHostname,
  verificationTxtValue,
  buildVerificationToken,
} from './custom-domain-service.js';

describe('custom-domain-service helpers', () => {
  it('normalises hostnames', () => {
    expect(normaliseCustomDomainHostname(' Workspace.Client.EXAMPLE ')).toBe('workspace.client.example');
  });

  it('builds DNS verification record names and values', () => {
    const token = buildVerificationToken();
    expect(dnsVerificationRecordName('workspace.client.example')).toBe('_carina-verify.workspace.client.example');
    expect(verificationTxtValue(token)).toBe(`carina-verify=${token}`);
  });
});
