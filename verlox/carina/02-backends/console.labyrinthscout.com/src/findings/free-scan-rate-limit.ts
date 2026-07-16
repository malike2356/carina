import { getRedis } from '../redis.js';

const IP_WINDOW_SEC = 60 * 60;
const DOMAIN_WINDOW_SEC = 24 * 60 * 60;

function ipKey(ip: string): string {
  return `scout:free-scan:ip:${ip}`;
}

function domainKey(domain: string): string {
  return `scout:free-scan:domain:${domain}`;
}

export async function checkFreeScanRateLimit(
  ip: string,
  domain: string,
): Promise<{ allowed: true } | { allowed: false; reason: string; retryAfterSec?: number }> {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true };
  }

  const ipBlocked = await redis.get(ipKey(ip));
  if (ipBlocked) {
    const ttl = await redis.ttl(ipKey(ip));
    return {
      allowed: false,
      reason: 'Rate limit: 1 free scan per hour per IP.',
      retryAfterSec: ttl > 0 ? ttl : IP_WINDOW_SEC,
    };
  }

  const domainBlocked = await redis.get(domainKey(domain));
  if (domainBlocked) {
    const ttl = await redis.ttl(domainKey(domain));
    return {
      allowed: false,
      reason: 'This domain was scanned recently. Try again in 24 hours.',
      retryAfterSec: ttl > 0 ? ttl : DOMAIN_WINDOW_SEC,
    };
  }

  return { allowed: true };
}

export async function recordFreeScanRateLimit(ip: string, domain: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(ipKey(ip), '1', 'EX', IP_WINDOW_SEC);
  await redis.set(domainKey(domain), '1', 'EX', DOMAIN_WINDOW_SEC);
}
