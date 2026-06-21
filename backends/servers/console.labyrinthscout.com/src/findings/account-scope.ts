import type { Response } from 'express';
import type { RequestWithScoutAuth } from '../types/request.js';

function operatorAccountId(req: RequestWithScoutAuth): string | null {
  const fromQuery = req.query.account_id;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }
  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = body?.account_id;
  if (typeof fromBody === 'string' && fromBody.trim()) {
    return fromBody.trim();
  }
  const fromEnv = process.env.SCOUT_OPERATOR_ACCOUNT_ID?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

export function resolveAccountId(req: RequestWithScoutAuth, res: Response): string | null {
  if (req.scoutAuth?.kind === 'account') {
    return req.scoutAuth.accountId;
  }

  if (req.scoutAuth?.kind === 'operator') {
    const accountId = operatorAccountId(req);
    if (accountId) return accountId;
  }

  res.status(400).json({
    error: 'account_id is required for operator requests',
  });
  return null;
}
