import type { NextFunction, Request, Response } from 'express';
import { resolvePartnerApiKey } from '../../hosted/partner-api-key-service.js';
import { getPartnerAccount } from '../../hosted/partner-service.js';

export interface GatewayRequest extends Request {
  partner?: {
    keyId: string;
    partnerId: string;
    partnerName: string;
    scopes: string[];
    revenueShareBps: number;
  };
}

export async function partnerGatewayAuth(
  req: GatewayRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_bearer_token', message: 'Authorization: Bearer <key> header required.', requestId: req.requestId });
    return;
  }
  const rawKey = authHeader.slice(7);
  const key = await resolvePartnerApiKey(rawKey);
  if (!key) {
    res.status(401).json({ error: 'invalid_api_key', message: 'API key not found or revoked.', requestId: req.requestId });
    return;
  }
  const partner = await getPartnerAccount(key.partnerId);
  if (!partner || partner.status !== 'active') {
    res.status(403).json({ error: 'partner_account_inactive', message: 'Partner account is not active.', requestId: req.requestId });
    return;
  }
  req.partner = {
    keyId: key.id,
    partnerId: key.partnerId,
    partnerName: partner.name,
    scopes: key.scopes,
    revenueShareBps: key.revenueShareBps,
  };
  next();
}

export function requireScope(scope: string) {
  return (req: GatewayRequest, res: Response, next: NextFunction): void => {
    if (!req.partner?.scopes.includes(scope)) {
      res.status(403).json({ error: 'insufficient_scope', required: scope, message: `This key does not have the '${scope}' scope.`, requestId: req.requestId });
      return;
    }
    next();
  };
}
