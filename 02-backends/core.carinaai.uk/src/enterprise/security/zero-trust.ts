import fs from 'node:fs';
import tls from 'node:tls';
import type { NetworkPolicyRule, ZeroTrustStatus } from './types.js';

export const DEFAULT_NETWORK_POLICIES: NetworkPolicyRule[] = [
  { from: 'carina-gateway', to: 'carina-core', port: 4444, protocol: 'tcp', action: 'allow' },
  { from: 'carina-core', to: 'scout-engine', port: 5555, protocol: 'tcp', action: 'allow' },
  { from: 'scout-engine', to: 'postgres', port: 5432, protocol: 'tcp', action: 'allow' },
  { from: 'carina-core', to: 'internet', port: 443, protocol: 'tcp', action: 'allow' },
  { from: '*', to: '*', port: 0, protocol: 'tcp', action: 'deny' },
];

export function loadNetworkPolicies(): NetworkPolicyRule[] {
  const raw = process.env.CARINA_ZERO_TRUST_POLICIES?.trim();
  if (!raw) return DEFAULT_NETWORK_POLICIES;
  try {
    const parsed = JSON.parse(raw) as NetworkPolicyRule[];
    return Array.isArray(parsed) ? parsed : DEFAULT_NETWORK_POLICIES;
  } catch {
    return DEFAULT_NETWORK_POLICIES;
  }
}

export function evaluateNetworkPolicy(from: string, to: string, port: number): boolean {
  const policies = loadNetworkPolicies();
  const allows = policies.filter((row) => row.action === 'allow');
  const denies = policies.filter((row) => row.action === 'deny');

  const allowed = allows.some((row) =>
    (row.from === from || row.from === '*')
    && (row.to === to || row.to === '*')
    && (row.port === port || row.port === 0),
  );
  if (allowed) return true;

  const denied = denies.some((row) =>
    (row.from === from || row.from === '*')
    && (row.to === to || row.to === '*')
    && (row.port === port || row.port === 0),
  );
  return !denied;
}

export function buildSpiffeId(serviceName: string): string {
  const trustDomain = process.env.SPIFFE_TRUST_DOMAIN?.trim() || 'carina.ai';
  return `spiffe://${trustDomain}/${serviceName}`;
}

export function describeZeroTrustStatus(): ZeroTrustStatus {
  const mtlsEnabled = process.env.CARINA_MTLS_ENABLED === 'true';
  return {
    mtlsEnabled,
    spiffeTrustDomain: process.env.SPIFFE_TRUST_DOMAIN?.trim() || 'carina.ai',
    policies: loadNetworkPolicies(),
    servicesWithIdentity: ['carina-gateway', 'carina-core', 'scout-engine', 'carina-web'],
  };
}

export type MtlsMaterial = {
  certPath: string;
  keyPath: string;
  caPath: string;
};

export function resolveMtlsMaterial(serviceName: string): MtlsMaterial {
  const base = process.env.CARINA_MTLS_CERT_DIR?.trim() || '/etc/carina/mtls';
  return {
    certPath: `${base}/${serviceName}.crt`,
    keyPath: `${base}/${serviceName}.key`,
    caPath: `${base}/ca-bundle.crt`,
  };
}

export function createMtlsServerOptions(material: MtlsMaterial): tls.TlsOptions {
  return {
    cert: fs.readFileSync(material.certPath),
    key: fs.readFileSync(material.keyPath),
    ca: fs.readFileSync(material.caPath),
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.3',
  };
}

export function createMtlsClientOptions(material: MtlsMaterial): tls.ConnectionOptions {
  return {
    cert: fs.readFileSync(material.certPath),
    key: fs.readFileSync(material.keyPath),
    ca: fs.readFileSync(material.caPath),
    rejectUnauthorized: true,
    minVersion: 'TLSv1.3',
  };
}

export function renderCiliumNetworkPolicy(): string {
  const allowRules = loadNetworkPolicies().filter((row) => row.action === 'allow' && row.from !== '*');
  const ingress = allowRules.map((row) => `        - fromEndpoints:
            - matchLabels:
                app: ${row.from}
          toPorts:
            - ports:
                - port: "${row.port}"
                  protocol: ${row.protocol.toUpperCase()}`).join('\n');

  return `apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: carina-zero-trust
spec:
  endpointSelector:
    matchLabels:
      app: carina
  ingress:
${ingress || '    - {}'}
  egress:
    - toEndpoints:
        - matchLabels:
            app: postgres
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
`;
}
