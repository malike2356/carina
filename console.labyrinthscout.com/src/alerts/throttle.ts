import { getRedis } from '../redis.js';

interface ThrottleResult {
  suppress: boolean;
  aggregatedCount?: number;
}

const WINDOW_SECONDS = 300; // 5 minutes
const ESCALATE_AFTER = 10; // 10 suppressions in an hour triggers escalation

/**
 * Per-tenant, per-severity 5-minute throttle.
 * Max 1 alert per severity per tenant per 5 minutes.
 * Duplicates increment a counter; the 11th suppression in an hour triggers escalation.
 */
export async function shouldSuppress(
  tenantId: string,
  severity: string,
  eventType: string,
): Promise<ThrottleResult> {
  const redis = getRedis();
  if (!redis) return { suppress: false };

  const key = `scout:alert-throttle:${tenantId}:${severity}:${eventType}`;
  const countKey = `scout:alert-throttle-count:${tenantId}:${severity}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
      return { suppress: false };
    }

    // Within the window — suppress and aggregate
    const aggregatedCount = await redis.incr(countKey);
    if (aggregatedCount === 1) {
      await redis.expire(countKey, 3600); // 1 hour window for escalation tracking
    }

    return {
      suppress: true,
      aggregatedCount,
    };
  } catch {
    return { suppress: false };
  }
}

export async function shouldEscalate(tenantId: string, severity: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const countKey = `scout:alert-throttle-count:${tenantId}:${severity}`;
  try {
    const count = await redis.get(countKey);
    return (Number(count) || 0) >= ESCALATE_AFTER;
  } catch {
    return false;
  }
}
