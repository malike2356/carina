import type { Request, Response } from 'express';

export function resolveAccountId(req: Request, res: Response): string | null {
  if (req.scoutAuth?.kind === 'account') {
    return req.scoutAuth.accountId;
  }

  if (req.scoutAuth?.kind === 'operator') {
    const fromQuery = req.query.account_id;
    if (typeof fromQuery === 'string' && fromQuery.trim()) {
      return fromQuery.trim();
    }
    const body = req.body as Record<string, unknown> | undefined;
    const fromBody = body?.account_id;
    if (typeof fromBody === 'string' && fromBody.trim()) {
      return fromBody.trim();
    }
  }

  res.status(400).json({
    error: 'account_id is required for operator requests',
  });
  return null;
}
