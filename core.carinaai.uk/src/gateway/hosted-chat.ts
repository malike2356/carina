import type { Request } from 'express';
import { checkHostedQuota } from '../api/hosted.js';

export function resolveExternalId(req: Request): string {
  if (req.hostedUser) {
    return `hosted:${req.hostedUser.id}`;
  }
  const fromBody = req.body?.sessionId;
  const fromQuery = req.query?.sessionId;
  return String(fromBody ?? fromQuery ?? 'anonymous');
}

export async function enforceHostedQuota(req: Request): Promise<string | null> {
  if (!req.hostedUser) return null;
  return checkHostedQuota(req.hostedUser.id, req.hostedUser.tier);
}
