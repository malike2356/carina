import type { Request } from 'express';
import { checkHostedQuota } from '../api/hosted.js';
import { resolveRequestExternalUserId } from '../surfaces/index.js';

export function resolveClientSessionId(req: Request): string {
  const fromBody = req.body?.sessionId;
  const fromQuery = req.query?.sessionId;
  return String(fromBody ?? fromQuery ?? 'default');
}

/** Stable external user id for gateway session maps (web, mobile, hosted). */
export function resolveExternalId(req: Request): string {
  return resolveRequestExternalUserId(req);
}

export async function enforceHostedQuota(req: Request): Promise<string | null> {
  if (!req.hostedUser) return null;
  return checkHostedQuota(req.hostedUser.id, req.hostedUser.tier);
}
