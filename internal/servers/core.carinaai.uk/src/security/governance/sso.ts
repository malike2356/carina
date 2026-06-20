import {
  describeSsoReadiness,
  DEFAULT_SSO_PROVIDERS,
  listConfiguredSsoProviders,
} from '../compliance/sso.js';

export {
  DEFAULT_SSO_PROVIDERS,
  describeSsoReadiness,
  listConfiguredSsoProviders,
};
export type {
  AttributeMapping,
  SSOConfig,
  SSOProvider,
  SSOProviderType,
} from '../compliance/sso.js';

export function governanceSsoSummary(): {
  supportedProtocols: string[];
  jitProvisioning: boolean;
  scimSupported: boolean;
  abacSupported: boolean;
  providersConfigured: number;
} {
  const readiness = describeSsoReadiness();
  return {
    supportedProtocols: ['saml', 'oidc', 'ldap', 'oauth2'],
    jitProvisioning: readiness.jitProvisioningSupported,
    scimSupported: readiness.scimSupported,
    abacSupported: readiness.abacSupported,
    providersConfigured: readiness.providersConfigured,
  };
}
