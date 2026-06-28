import type { NextFunction, Request, Response } from 'express';
import type { PartnerApiKey } from '../../hosted/partner-api-key-service.js';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000;

export function partnerRateLimit(
  req: Request & { partnerApiKey?: PartnerApiKey },
  res: Response,
  next: NextFunction,
): void {
  const key = req.partnerApiKey;
  if (!key) {
    next();
    return;
  }

  const now = Date.now();
  const entry = windows.get(key.id);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    windows.set(key.id, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= key.rateLimitRpm) {
    const resetAt = new Date(entry.windowStart + WINDOW_MS).toISOString();
    res.status(429).json({ error: 'rate_limit_exceeded', limit: key.rateLimitRpm, reset_at: resetAt });
    return;
  }

  entry.count += 1;
  next();
}
