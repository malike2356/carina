import type { NextFunction, Response } from 'express';
import type { GatewayRequest } from './partner-gateway-auth.js';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000;

export function partnerRateLimit(
  req: GatewayRequest,
  res: Response,
  next: NextFunction,
): void {
  const partner = req.partner;
  if (!partner?.keyId) {
    next();
    return;
  }

  const now = Date.now();
  const entry = windows.get(partner.keyId);
  const limit = partner.rateLimitRpm > 0 ? partner.rateLimitRpm : 60;

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    windows.set(partner.keyId, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= limit) {
    const resetAt = new Date(entry.windowStart + WINDOW_MS).toISOString();
    res.status(429).json({
      error: 'rate_limit_exceeded',
      limit,
      reset_at: resetAt,
      requestId: req.requestId,
    });
    return;
  }

  entry.count += 1;
  next();
}

/** Test helper */
export function _resetPartnerRateLimitForTests(): void {
  windows.clear();
}
