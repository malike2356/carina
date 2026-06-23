import { canonicalAppHost, isCanonicalAppHost, isControlPlaneHost, normaliseHost } from './hosted-domain.js';
import { lookupVerifiedCustomDomain } from '../hosted/custom-domain-service.js';

export type HostedHostContext = {
  hostname: string;
  isCanonical: boolean;
  isCustomDomain: boolean;
  isControlPlane: boolean;
  orgId: string | null;
  partnerId: string | null;
  canonicalHost: string;
};

function normaliseHostname(hostname: string): string {
  return normaliseHost(hostname);
}

export async function resolveHostedHostContext(hostname: string): Promise<HostedHostContext> {
  const host = normaliseHostname(hostname);
  const canonicalHost = canonicalAppHost();

  if (isControlPlaneHost(host)) {
    return {
      hostname: host,
      isCanonical: false,
      isCustomDomain: false,
      isControlPlane: true,
      orgId: null,
      partnerId: null,
      canonicalHost,
    };
  }

  if (isCanonicalAppHost(host)) {
    return {
      hostname: host,
      isCanonical: true,
      isCustomDomain: false,
      isControlPlane: false,
      orgId: null,
      partnerId: null,
      canonicalHost,
    };
  }

  const domain = await lookupVerifiedCustomDomain(host);
  if (!domain) {
    return {
      hostname: host,
      isCanonical: false,
      isCustomDomain: false,
      isControlPlane: false,
      orgId: null,
      partnerId: null,
      canonicalHost,
    };
  }

  return {
    hostname: host,
    isCanonical: domain.isCanonical,
    isCustomDomain: true,
    isControlPlane: false,
    orgId: domain.orgId,
    partnerId: domain.partnerId,
    canonicalHost: domain.isCanonical ? domain.hostname : canonicalHost,
  };
}
