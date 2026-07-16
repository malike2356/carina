import { config } from '../config/index.js';
import { isHostedEnabled, isOperatorHost, operatorHosts } from '../gateway/hosted-domain.js';
import { hostedShellConfig, privateShellConfig } from './shell-config.js';
import type { ProductMode, ProductSurface } from './types.js';

const OPS_HOSTNAMES = new Set(
  (process.env.CARINA_OPS_HOSTS ?? `ops.${config.product.domain}`)
    .split(',')
    .map((h) => h.split(':')[0].trim().toLowerCase())
    .filter(Boolean),
);

function normaliseHost(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase();
}

export function resolveProductMode(hostname: string): ProductMode {
  const override = process.env.CARINA_PRODUCT_MODE?.trim().toLowerCase();
  if (override === 'hosted' || override === 'private' || override === 'ops') {
    return override;
  }

  const host = normaliseHost(hostname);
  if (OPS_HOSTNAMES.has(host)) {
    return 'ops';
  }
  if (isOperatorHost(host)) {
    return 'private';
  }
  if (isHostedEnabled()) {
    return 'hosted';
  }
  return 'private';
}

export function isHostedSurface(hostname: string): boolean {
  return resolveProductMode(hostname) === 'hosted';
}

export function isPrivateSurface(hostname: string): boolean {
  return resolveProductMode(hostname) === 'private';
}

export function hostedAppHostname(): string {
  return config.hosted.appHost;
}

export function hostedAppOrigin(): string {
  const host = config.hosted.appHost;
  const proto = process.env.CARINA_HOSTED_APP_PROTO ?? 'https';
  return `${proto}://${host}`;
}

export function resolveProductSurface(hostname: string): ProductSurface {
  const mode = resolveProductMode(hostname);
  const host = normaliseHost(hostname);

  if (mode === 'hosted') {
    return {
      mode,
      hostname: host,
      branding: {
        productName: 'Carina Cloud',
        workspaceName: 'Carina Cloud',
        titleSuffix: 'Carina Cloud',
        loginPath: '/hosted-login',
        defaultLanding: '/hosted-login',
      },
      shell: hostedShellConfig(),
    };
  }

  if (mode === 'ops') {
    return {
      mode,
      hostname: host,
      branding: {
        productName: 'Carina Ops',
        workspaceName: 'Carina Ops',
        titleSuffix: 'Carina Ops',
        loginPath: '/login',
        defaultLanding: '/',
      },
      shell: privateShellConfig(),
    };
  }

  return {
    mode: 'private',
    hostname: host,
    branding: {
      productName: 'Carina',
      workspaceName: 'Carina Instance',
      titleSuffix: 'Private Instance',
      loginPath: '/login',
      defaultLanding: '/login',
    },
    shell: privateShellConfig(),
  };
}

export function operatorHostList(): string[] {
  return operatorHosts();
}
