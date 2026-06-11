import type { Request } from 'express';
import { checkHostedQuota } from '../api/hosted.js';

export function resolveClientSessionId(req: Request): string {
  const fromBody = req.body?.sessionId;
  const fromQuery = req.query?.sessionId;
  return String(fromBody ?? fromQuery ?? 'default');
}

export function resolveExternalId(req: Request): string {
  const clientSessionId = resolveClientSessionId(req);
  if (req.hostedUser) {
    return `hosted:${req.hostedUser.id}:${clientSessionId}`;
  }
  return clientSessionId;
}

export async function enforceHostedQuota(req: Request): Promise<string | null> {
  if (!req.hostedUser) return null;
  return checkHostedQuota(req.hostedUser.id, req.hostedUser.tier);
}
