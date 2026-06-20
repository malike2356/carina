import type { NextFunction, Response } from 'express';
import { opsToken } from './ops-config.js';

export function authorizeOps(req: { headers: { authorization?: string }; body?: unknown }): boolean {
  const expected = opsToken();
  if (!expected) return false;
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const body =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as { token?: string })
      : undefined;
  const bodyToken = typeof body?.token === 'string' ? body.token : '';
  return bearer === expected || bodyToken === expected;
}

export function requireOpsAuth(
  req: Parameters<typeof authorizeOps>[0],
  res: Response,
  next: NextFunction,
): void {
  if (authorizeOps(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
