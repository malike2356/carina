import { config } from '../config/index.js';

function normaliseHost(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase();
}

export { normaliseHost };

const CONTROL_PLANE_HOSTS = new Set(
  (process.env.CARINA_CONTROL_PLANE_HOSTS
    ?? `core.${config.product.domain},ops.${config.product.domain}`)
    .split(',')
    .map((h) => normaliseHost(h))
    .filter(Boolean),
);

export function canonicalAppHost(): string {
  return normaliseHost(process.env.CARINA_HOSTED_APP_HOST ?? config.hosted.appHost);
}

export function isCanonicalAppHost(hostname: string): boolean {
  return normaliseHost(hostname) === canonicalAppHost();
}

export function isControlPlaneHost(hostname: string): boolean {
  const host = normaliseHost(hostname);
  return isOperatorHost(host) || CONTROL_PLANE_HOSTS.has(host);
}

export function operatorHosts(): string[] {
  const raw = process.env.CARINA_OPERATOR_HOSTS
    ?? config.hosted.operatorHosts.join(',');
  return raw.split(',').map((h) => normaliseHost(h)).filter(Boolean);
}

export function isOperatorHost(hostname: string): boolean {
  return operatorHosts().includes(normaliseHost(hostname));
}

export function isHostedEnabled(): boolean {
  return process.env.HOSTED_MODE === 'true' || config.hosted.enabled;
}

export function isHostedRequest(hostname: string): boolean {
  return isHostedEnabled() && !isOperatorHost(hostname);
}

export function hostedAppOrigin(req: { protocol: string; get: (name: string) => string | undefined }): string {
  const host = req.get('host') ?? config.hosted.appHost;
  return `${req.protocol}://${host}`;
}
