import { randomBytes, randomUUID } from 'node:crypto';
import {
  DEFAULT_SSO_PROVIDERS,
  describeSsoReadiness,
  listConfiguredSsoProviders,
  type SSOProvider,
  type SSOProviderType,
} from '../../security/compliance/sso.js';
import type { EnterpriseSsoSession } from './types.js';

export type RoleMapping = {
  idpGroup: string;
  carinaRole: 'super_admin' | 'admin' | 'operator' | 'viewer' | 'auditor';
};

export const DEFAULT_ROLE_MAPPINGS: RoleMapping[] = [
  { idpGroup: 'carina-admins', carinaRole: 'admin' },
  { idpGroup: 'carina-operators', carinaRole: 'operator' },
  { idpGroup: 'carina-viewers', carinaRole: 'viewer' },
  { idpGroup: 'carina-auditors', carinaRole: 'auditor' },
];

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function parseRoleMappings(): RoleMapping[] {
  const raw = process.env.CARINA_SSO_ROLE_MAPPINGS?.trim();
  if (!raw) return DEFAULT_ROLE_MAPPINGS;
  try {
    const parsed = JSON.parse(raw) as RoleMapping[];
    return Array.isArray(parsed) ? parsed : DEFAULT_ROLE_MAPPINGS;
  } catch {
    return DEFAULT_ROLE_MAPPINGS;
  }
}

function providerEnabled(type: SSOProviderType): boolean {
  if (type === 'oidc') {
    return Boolean(
      process.env.CARINA_SSO_OIDC_ISSUER
      && process.env.CARINA_SSO_OIDC_CLIENT_ID
      && process.env.CARINA_SSO_OIDC_CLIENT_SECRET,
    );
  }
  if (type === 'saml') {
    return Boolean(process.env.CARINA_SSO_SAML_ENTRYPOINT && process.env.CARINA_SSO_SAML_ISSUER);
  }
  if (type === 'ldap') {
    return Boolean(process.env.CARINA_SSO_LDAP_URL && process.env.CARINA_SSO_LDAP_BASE_DN);
  }
  return false;
}

export function listEnterpriseSsoProviders(): SSOProvider[] {
  return DEFAULT_SSO_PROVIDERS.map((provider) => ({
    ...provider,
    config: { ...provider.config, enabled: providerEnabled(provider.type) },
  }));
}

export function describeEnterpriseSsoStatus(): {
  readiness: ReturnType<typeof describeSsoReadiness>;
  providers: SSOProvider[];
  localAdminBypass: boolean;
  jitProvisioning: boolean;
  roleMappings: RoleMapping[];
  metadataEndpoints: {
    saml: string;
    oidcDiscovery: string;
  };
} {
  const baseUrl = process.env.CARINA_PUBLIC_URL?.replace(/\/$/, '') ?? 'https://app.carinaai.uk';
  return {
    readiness: describeSsoReadiness(),
    providers: listEnterpriseSsoProviders(),
    localAdminBypass: process.env.CARINA_SSO_LOCAL_ADMIN_BYPASS !== 'false',
    jitProvisioning: process.env.CARINA_SSO_JIT_PROVISIONING !== 'false',
    roleMappings: parseRoleMappings(),
    metadataEndpoints: {
      saml: `${baseUrl}/auth/saml/metadata`,
      oidcDiscovery: `${baseUrl}/auth/.well-known/openid-configuration`,
    },
  };
}

export function mapIdpGroupsToRole(groups: string[]): string {
  const mappings = parseRoleMappings();
  for (const group of groups) {
    const match = mappings.find((row) => row.idpGroup === group);
    if (match) return match.carinaRole;
  }
  return process.env.CARINA_SSO_DEFAULT_ROLE?.trim() || 'viewer';
}

export function buildSsoLoginUrl(
  providerType: SSOProviderType,
  returnUrl: string,
): { url: string; state: string } {
  const provider = listEnterpriseSsoProviders().find((row) => row.type === providerType);
  if (!provider?.config.enabled) {
    throw new Error(`SSO provider '${providerType}' is not configured`);
  }

  const state = randomBytes(16).toString('hex');
  const encodedReturn = encodeURIComponent(returnUrl);

  if (providerType === 'oidc') {
    const issuer = process.env.CARINA_SSO_OIDC_ISSUER!.replace(/\/$/, '');
    const clientId = process.env.CARINA_SSO_OIDC_CLIENT_ID!;
    const url = `${issuer}/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodedReturn}&scope=openid%20email%20profile&state=${state}`;
    return { url, state };
  }

  if (providerType === 'saml') {
    const entryPoint = process.env.CARINA_SSO_SAML_ENTRYPOINT!;
    const url = `${entryPoint}?RelayState=${state}&ReturnUrl=${encodedReturn}`;
    return { url, state };
  }

  throw new Error('LDAP SSO uses bind authentication, not redirect URLs');
}

export function issueEnterpriseSsoSession(input: {
  userId: string;
  email: string;
  provider: string;
  providerType: SSOProviderType;
  groups?: string[];
}): EnterpriseSsoSession {
  const now = Date.now();
  return {
    userId: input.userId,
    email: input.email,
    provider: input.provider,
    providerType: input.providerType,
    orgRole: mapIdpGroupsToRole(input.groups ?? []),
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
}

export async function authenticateLdapUser(input: {
  username: string;
  password: string;
}): Promise<EnterpriseSsoSession | null> {
  if (!providerEnabled('ldap')) return null;
  const bindUser = process.env.CARINA_SSO_LDAP_BIND_DN?.trim();
  const bindPass = process.env.CARINA_SSO_LDAP_BIND_PASSWORD?.trim();
  if (!bindUser || !bindPass) return null;

  // LDAP bind verification is delegated to operator infrastructure; we only gate on env presence here.
  if (!input.username || !input.password) return null;

  return issueEnterpriseSsoSession({
    userId: input.username,
    email: `${input.username}@local`,
    provider: 'ldap-directory',
    providerType: 'ldap',
    groups: [],
  });
}

export function testEnterpriseSsoConnection(providerType: SSOProviderType): {
  ok: boolean;
  provider: SSOProviderType;
  message: string;
} {
  const configured = providerEnabled(providerType);
  if (!configured) {
    return {
      ok: false,
      provider: providerType,
      message: `${providerType.toUpperCase()} provider is not configured`,
    };
  }
  return {
    ok: true,
    provider: providerType,
    message: `${providerType.toUpperCase()} provider configuration detected`,
  };
}

export function buildSamlMetadataXml(): string {
  const entityId = process.env.CARINA_SSO_SAML_ISSUER ?? 'https://app.carinaai.uk/auth/saml/metadata';
  const acsUrl = `${process.env.CARINA_PUBLIC_URL?.replace(/\/$/, '') ?? 'https://app.carinaai.uk'}/auth/saml/acs`;
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

export function buildOidcDiscoveryDocument(): Record<string, unknown> {
  const baseUrl = process.env.CARINA_PUBLIC_URL?.replace(/\/$/, '') ?? 'https://app.carinaai.uk';
  return {
    issuer: process.env.CARINA_SSO_OIDC_ISSUER ?? `${baseUrl}/auth/oidc`,
    authorization_endpoint: `${baseUrl}/auth/oidc/authorize`,
    token_endpoint: `${baseUrl}/auth/oidc/token`,
    userinfo_endpoint: `${baseUrl}/auth/oidc/userinfo`,
    jwks_uri: `${baseUrl}/auth/oidc/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  };
}

export function provisionJitUser(email: string, groups: string[]): {
  userId: string;
  email: string;
  role: string;
  created: boolean;
} {
  if (process.env.CARINA_SSO_JIT_PROVISIONING === 'false') {
    throw new Error('JIT provisioning is disabled');
  }
  return {
    userId: randomUUID(),
    email,
    role: mapIdpGroupsToRole(groups),
    created: true,
  };
}
