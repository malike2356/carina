import { SAML } from 'node-saml';
import type { WorkspaceSsoProvider } from '@/db/schema';
import { getDecryptedSamlCertificate } from './workspace-sso';

export function normalizeCertificate(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;
  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

export function validateCertificatePem(raw: string): boolean {
  try {
    const pem = normalizeCertificate(raw);
    const body = pem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    return body.length >= 64 && /^[A-Za-z0-9+/=]+$/.test(body);
  } catch {
    return false;
  }
}

export function buildSamlClient(provider: WorkspaceSsoProvider, acsUrl: string): SAML | null {
  const cert = getDecryptedSamlCertificate(provider);
  if (!provider.samlSsoUrl || !cert) return null;

  return new SAML({
    issuer: acsUrl.replace(/\/api\/auth\/sso\/saml\/acs$/, ''),
    callbackUrl: acsUrl,
    entryPoint: provider.samlSsoUrl,
    cert: normalizeCertificate(cert),
    audience: acsUrl.replace(/\/api\/auth\/sso\/saml\/acs$/, ''),
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  });
}

export async function getSamlAuthorizeUrl(
  provider: WorkspaceSsoProvider,
  acsUrl: string,
): Promise<string> {
  const client = buildSamlClient(provider, acsUrl);
  if (!client) throw new Error('SAML provider is misconfigured');
  return client.getAuthorizeUrl({});
}

export interface SamlProfile {
  nameID?: string;
  email?: string;
  displayName?: string;
  [key: string]: unknown;
}

export async function validateSamlPostResponse(
  provider: WorkspaceSsoProvider,
  acsUrl: string,
  body: { SAMLResponse?: string; RelayState?: string },
): Promise<{ profile: SamlProfile; relayState?: string }> {
  const client = buildSamlClient(provider, acsUrl);
  if (!client) throw new Error('SAML provider is misconfigured');
  const { profile } = await client.validatePostResponse(body);
  return { profile: profile as SamlProfile, relayState: body.RelayState };
}
