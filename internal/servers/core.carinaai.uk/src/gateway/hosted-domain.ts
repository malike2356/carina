import { config } from '../config/index.js';

function normaliseHost(hostname: string): string {
  return hostname.split(':')[0].trim().toLowerCase();
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
