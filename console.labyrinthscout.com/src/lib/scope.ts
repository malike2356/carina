import type { Request } from 'express';

export function scopedAccountId(req: Request): string | null {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  return null;
}

export function isOperatorAuth(req: Request): boolean {
  return req.scoutAuth?.kind === 'operator';
}
