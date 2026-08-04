import crypto from 'node:crypto';

export const CUSTOM_DOMAIN_VERIFY_PREFIX = 'carina-verify=';

export function normaliseCustomDomainHostname(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
}

export function canonicalAppHost(): string {
  return normaliseCustomDomainHostname(
    process.env.CARINA_HOSTED_APP_HOST
      ?? process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').split('/')[0]
      ?? 'app.carinaai.uk',
  );
}

export function isCanonicalAppHost(hostname: string): boolean {
  return normaliseCustomDomainHostname(hostname) === canonicalAppHost();
}

export function dnsVerificationRecordName(hostname: string): string {
  return `_carina-verify.${normaliseCustomDomainHostname(hostname)}`;
}

export function buildVerificationToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function verificationTxtValue(token: string): string {
  return `${CUSTOM_DOMAIN_VERIFY_PREFIX}${token}`;
}

export function domainVerificationInstructions(hostname: string, token: string) {
  return {
    verificationRecord: dnsVerificationRecordName(hostname),
    verificationValue: verificationTxtValue(token),
  };
}
