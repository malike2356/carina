import type { RequestWithScoutAuth } from '../types/request.js';

export function scopedAccountId(req: RequestWithScoutAuth): string | null {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  return null;
}

export function isOperatorAuth(req: RequestWithScoutAuth): boolean {
  return req.scoutAuth?.kind === 'operator';
}
