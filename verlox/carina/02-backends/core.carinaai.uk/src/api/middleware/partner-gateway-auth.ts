/**
 * Partner gateway auth with client approval and token anomaly gates.
 */

import type { NextFunction, Request, Response } from 'express';
import { resolvePartnerApiKey } from '../../hosted/partner-api-key-service.js';
import { getPartnerAccount } from '../../hosted/partner-service.js';
import { buildClientFingerprint } from '../../security/client-fingerprint.js';
import {
  ensureClientAccess,
  learnTokenBaseline,
} from '../../security/client-approval-store.js';
import {
  monitorTokenRequest,
  recordFailedAuth,
  recordPendingClientBurst,
  recordScopeViolation,
} from '../../security/token-anomaly-monitor.js';

export interface GatewayRequest extends Request {
  partner?: {
    keyId: string;
    partnerId: string;
    partnerName: string;
    scopes: string[];
    revenueShareBps: number;
    rateLimitRpm: number;
  };
}

export async function partnerGatewayAuth(
  req: GatewayRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    recordFailedAuth(extractClientIpHint(req), { reason: 'missing_bearer' });
    res.status(401).json({
      error: 'missing_bearer_token',
      message: 'Authorization: Bearer <key> header required.',
      requestId: req.requestId,
    });
    return;
  }
  const rawKey = authHeader.slice(7);
  const key = await resolvePartnerApiKey(rawKey);
  if (!key) {
    recordFailedAuth(extractClientIpHint(req), { reason: 'invalid_api_key' });
    res.status(401).json({
      error: 'invalid_api_key',
      message: 'API key not found or revoked.',
      requestId: req.requestId,
    });
    return;
  }
  const partner = await getPartnerAccount(key.partnerId);
  if (!partner || partner.status !== 'active') {
    res.status(403).json({
      error: 'partner_account_inactive',
      message: 'Partner account is not active.',
      requestId: req.requestId,
    });
    return;
  }

  const fingerprint = buildClientFingerprint(req, {
    tenantId: key.partnerId,
    tokenId: key.id,
  });

  try {
    const access = await ensureClientAccess({
      tenantId: key.partnerId,
      tokenId: key.id,
      fingerprint,
      requestedScopes: key.scopes,
    });
    if (!access.allowed) {
      if (access.status === 'pending') {
        recordPendingClientBurst(key.partnerId);
      }
      if (access.retryAfterSeconds) {
        res.setHeader('Retry-After', String(access.retryAfterSeconds));
      }
      res.status(403).json({
        error: access.code ?? 'CLIENT_PENDING_APPROVAL',
        message: access.message ?? 'Client access denied.',
        status: access.status,
        fingerprint: fingerprint.fingerprint,
        requestId: req.requestId,
      });
      return;
    }

    const anomaly = await monitorTokenRequest({
      tokenId: key.id,
      tenantId: key.partnerId,
      fingerprint,
      rateLimitRpm: key.rateLimitRpm,
    });
    if (anomaly.blocked) {
      res.status(403).json({
        error: anomaly.code ?? 'TOKEN_SUSPENDED',
        message: anomaly.message ?? 'Token suspended due to anomalous activity.',
        reasons: anomaly.reasons,
        requestId: req.requestId,
      });
      return;
    }

    if (access.status === 'approved') {
      await learnTokenBaseline(key.id, fingerprint).catch(() => {});
    }
  } catch (err) {
    console.warn('[partner-gateway-auth] client approval check failed open:', err);
  }

  req.partner = {
    keyId: key.id,
    partnerId: key.partnerId,
    partnerName: partner.name,
    scopes: key.scopes,
    revenueShareBps: key.revenueShareBps,
    rateLimitRpm: key.rateLimitRpm,
  };
  next();
}

export function requireScope(scope: string) {
  return (req: GatewayRequest, res: Response, next: NextFunction): void => {
    if (!req.partner?.scopes.includes(scope)) {
      if (req.partner?.keyId) {
        recordScopeViolation(req.partner.keyId, scope);
      }
      res.status(403).json({
        error: 'insufficient_scope',
        required: scope,
        message: `This key does not have the '${scope}' scope.`,
        requestId: req.requestId,
      });
      return;
    }
    next();
  };
}

function extractClientIpHint(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return forwarded || req.ip || 'unknown';
}
