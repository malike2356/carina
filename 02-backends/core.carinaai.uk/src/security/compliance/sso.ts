export type SSOProviderType = 'saml' | 'oidc' | 'ldap';

export type SSOConfig = {
  issuer?: string;
  entryPoint?: string;
  clientId?: string;
  clientSecretEnv?: string;
  ldapUrl?: string;
  ldapBaseDn?: string;
  enabled: boolean;
};

export type AttributeMapping = {
  sourceAttribute: string;
  targetClaim: string;
  required?: boolean;
};

export type SSOProvider = {
  type: SSOProviderType;
  name: string;
  config: SSOConfig;
  mappings: AttributeMapping[];
};

export const DEFAULT_SSO_PROVIDERS: SSOProvider[] = [
  {
    type: 'oidc',
    name: 'OpenID Connect',
    config: {
      enabled: false,
      issuer: process.env.CARINA_SSO_OIDC_ISSUER,
      clientId: process.env.CARINA_SSO_OIDC_CLIENT_ID,
      clientSecretEnv: 'CARINA_SSO_OIDC_CLIENT_SECRET',
    },
    mappings: [
      { sourceAttribute: 'sub', targetClaim: 'userId', required: true },
      { sourceAttribute: 'email', targetClaim: 'email', required: true },
      { sourceAttribute: 'groups', targetClaim: 'orgRole' },
    ],
  },
  {
    type: 'saml',
    name: 'SAML 2.0',
    config: {
      enabled: false,
      entryPoint: process.env.CARINA_SSO_SAML_ENTRYPOINT,
      issuer: process.env.CARINA_SSO_SAML_ISSUER,
    },
    mappings: [
      { sourceAttribute: 'NameID', targetClaim: 'userId', required: true },
      { sourceAttribute: 'email', targetClaim: 'email', required: true },
    ],
  },
  {
    type: 'ldap',
    name: 'LDAP directory',
    config: {
      enabled: false,
      ldapUrl: process.env.CARINA_SSO_LDAP_URL,
      ldapBaseDn: process.env.CARINA_SSO_LDAP_BASE_DN,
    },
    mappings: [
      { sourceAttribute: 'uid', targetClaim: 'userId', required: true },
      { sourceAttribute: 'mail', targetClaim: 'email', required: true },
    ],
  },
];

export function listConfiguredSsoProviders(): SSOProvider[] {
  return DEFAULT_SSO_PROVIDERS.filter((row) => row.config.enabled);
}

export function describeSsoReadiness(): {
  providersConfigured: number;
  jitProvisioningSupported: boolean;
  scimSupported: boolean;
  abacSupported: boolean;
} {
  return {
    providersConfigured: listConfiguredSsoProviders().length,
    jitProvisioningSupported: true,
    scimSupported: false,
    abacSupported: true,
  };
}
